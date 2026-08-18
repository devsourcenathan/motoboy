<?php

declare(strict_types=1);

namespace App\Modules\Agencies\Http\Controllers;

use App\Modules\Administration\Actions\RecordAudit;
use App\Modules\Agencies\Support\AgencyContext;
use App\Modules\Identity\Enums\Locale;
use App\Modules\Identity\Enums\Role as RoleEnum;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Le personnel d'une agence.
 *
 * **Deux profils, parce que vendre engage de l'argent.** Un `AGENT` embarque —
 * valider un billet, voir les departs. Un `COUNTER` vend en plus. Les confondre
 * donnerait le droit d'encaisser a quelqu'un dont ce n'est pas le travail ;
 * l'alternative, leur donner le role `AGENCY`, leur ouvrirait aussi les
 * reversements et cette page meme.
 *
 * **Le compte se cree au numero.** Si la personne a deja un compte passager, le
 * role s'y ajoute : c'est la meme personne, et lui imposer un second compte
 * l'obligerait a jongler entre deux identites sur le meme telephone. Elle se
 * connecte par OTP comme partout ailleurs — aucun mot de passe n'est distribue.
 */
final class AgencyStaffController
{
    /** Ce qu'une agence peut attribuer. Jamais `AGENCY` : cela se delegue pas ici. */
    private const ASSIGNABLE = [RoleEnum::Agent, RoleEnum::Counter];

    public function __construct(
        private readonly AgencyContext $context,
        private readonly RecordAudit $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $agency = $this->context->require($request, 'staff.manage');

        $names = array_map(static fn (RoleEnum $role): string => $role->value, self::ASSIGNABLE);

        /*
         * Les membres, par leur rattachement **a cette agence** : le pivot porte
         * la portee, et un guichetier d'une autre agence n'a rien a faire ici.
         */
        $rows = DB::table('role_user')
            ->join('users', 'users.id', '=', 'role_user.user_id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->where('role_user.agency_id', $agency->id)
            ->whereIn('roles.name', $names)
            ->select([
                'users.id',
                'users.first_name',
                'users.last_name',
                'users.phone',
                'users.is_active',
                'roles.name as role',
            ])
            ->orderBy('users.first_name')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (object $row) => [
                'user_id' => (int) $row->id,
                'first_name' => $row->first_name,
                'last_name' => $row->last_name,
                'phone' => $row->phone,
                'role' => $row->role,
                'is_active' => (bool) $row->is_active,
            ])->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $agency = $this->context->require($request, 'staff.manage');
        $actor = $request->user();

        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:20'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'role' => ['required', 'string', 'in:AGENT,COUNTER'],
        ]);

        $phone = trim((string) $validated['phone']);

        /*
         * Le compte est cree s'il n'existe pas, sinon repris. **Le nom d'un compte
         * existant n'est pas ecrase** : il appartient a la personne, pas a
         * l'agence qui l'embauche, et le reecrire renommerait un passager a son
         * insu.
         */
        $user = User::query()->where('phone', $phone)->first();

        if ($user === null) {
            $user = new User;
            $user->phone = $phone;
            $user->first_name = (string) $validated['first_name'];
            $user->last_name = (string) $validated['last_name'];
            // La langue par defaut du pays ; la personne la changera dans ses
            // reglages, ou elle decide de la langue de ses SMS (I10).
            $user->locale = Locale::French;
            $user->is_active = true;
            $user->save();
        }

        $role = Role::query()->where('name', $validated['role'])->first();

        if ($role === null) {
            throw ApiException::of(ErrorCode::NotFound, 'Rôle inconnu.');
        }

        /*
         * `syncWithoutDetaching` plutot que `attach` : reajouter quelqu'un deja
         * present ne doit pas dupliquer la ligne, et le geste doit rester
         * rejouable — une agence qui reclique ne casse rien.
         */
        $user->roles()->syncWithoutDetaching([$role->id => ['agency_id' => $agency->id]]);

        $this->audit->handle(
            action: 'agency.staff_added',
            subject: $user,
            userId: $actor instanceof User ? $actor->id : null,
            new: ['role' => $validated['role'], 'agency_id' => $agency->id],
        );

        return response()->json([
            'user_id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'phone' => $user->phone,
            'role' => $validated['role'],
            'is_active' => (bool) $user->is_active,
        ], 201);
    }

    /**
     * Retire quelqu'un du personnel.
     *
     * **Le role est revoque, le compte survit.** Ses ventes et ses validations
     * restent a son nom : un historique qui perd son auteur ne se verifie plus. Et
     * la personne garde son compte passager, qui ne regarde pas l'agence.
     */
    public function destroy(Request $request, int $user): JsonResponse
    {
        $agency = $this->context->require($request, 'staff.manage');
        $actor = $request->user();

        $names = array_map(static fn (RoleEnum $role): string => $role->value, self::ASSIGNABLE);

        $roleIds = Role::query()->whereIn('name', $names)->pluck('id');

        $removed = DB::table('role_user')
            ->where('user_id', $user)
            ->where('agency_id', $agency->id)
            ->whereIn('role_id', $roleIds)
            ->delete();

        if ($removed === 0) {
            throw ApiException::of(ErrorCode::NotFound, 'Cette personne ne fait pas partie de votre personnel.');
        }

        $subject = User::query()->whereKey($user)->first();

        if ($subject !== null) {
            $this->audit->handle(
                action: 'agency.staff_removed',
                subject: $subject,
                userId: $actor instanceof User ? $actor->id : null,
                old: ['agency_id' => $agency->id],
            );
        }

        return response()->json(null, 204);
    }
}
