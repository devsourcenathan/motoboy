<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Requests;

use App\Modules\Administration\Support\IdDocumentPolicy;
use App\Modules\Bookings\Data\NewBooking;
use App\Modules\Bookings\Data\NewPassenger;
use App\Support\Http\ApiException;
use App\Support\Http\ErrorCode;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

final class CreateBookingRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'trip_reference' => ['required', 'string', 'max:20'],
            'passengers' => ['required', 'array', 'min:1', 'max:20'],
            'passengers.*.first_name' => ['required', 'string', 'max:100'],
            'passengers.*.last_name' => ['required', 'string', 'max:100'],
            'passengers.*.phone' => ['nullable', 'string', 'max:20'],
            'passengers.*.seat_id' => ['nullable', 'integer'],
            /*
             * La piece d'identite du **voyageur principal**, dans la forme que le
             * reglage de plateforme a rendue active. Les deux champs sont acceptes
             * ici et arbitres dans `withValidator` : refuser au niveau des regles
             * donnerait « le champ est requis » sur un champ que le client n'avait
             * aucune raison d'afficher.
             */
            'passengers.*.id_document_number' => ['nullable', 'string', 'max:50'],
            'passengers.*.id_document_path' => ['nullable', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:150'],
            'contact_phone' => ['nullable', 'string', 'max:20'],
        ];
    }

    public function newBooking(): NewBooking
    {
        // La validation a déjà tourné, mais l'entrée reste de la donnée HTTP :
        // on la narre explicitement plutôt que d'en décrire la forme dans un
        // docblock, qui serait une promesse que rien ne tient à l'exécution.
        $rows = $this->input('passengers');
        $passengers = [];

        foreach (is_array($rows) ? $rows : [] as $row) {
            if (!is_array($row)) {
                continue;
            }

            $phone = $row['phone'] ?? null;
            $seatId = $row['seat_id'] ?? null;

            $number = $row['id_document_number'] ?? null;
            $path = $row['id_document_path'] ?? null;

            /*
             * Seul le **premier** passager porte une piece. Celles envoyees pour
             * les suivants sont ignorees plutot que refusees : un client d'une
             * version ulterieure qui les enverrait ne doit pas voir ses
             * reservations rejetees, et la base n'a de toute facon rien a en
             * faire aujourd'hui.
             */
            $isMain = $passengers === [];

            $passengers[] = new NewPassenger(
                firstName: (string) ($row['first_name'] ?? ''),
                lastName: (string) ($row['last_name'] ?? ''),
                phone: is_string($phone) && $phone !== '' ? $phone : null,
                seatId: is_numeric($seatId) ? (int) $seatId : null,
                idDocumentNumber: $isMain && is_string($number) && $number !== '' ? $number : null,
                idDocumentPath: $isMain && is_string($path) && $path !== '' ? $path : null,
            );
        }

        $userId = $this->user()?->getAuthIdentifier();

        return new NewBooking(
            tripReference: $this->string('trip_reference')->toString(),
            passengers: $passengers,
            idempotencyKey: $this->idempotencyKey(),
            userId: is_numeric($userId) ? (int) $userId : null,
            contactName: $this->filled('contact_name') ? $this->string('contact_name')->toString() : null,
            contactPhone: $this->filled('contact_phone') ? $this->string('contact_phone')->toString() : null,
        );
    }

    /**
     * Applique la politique de piece d'identite (reglage de plateforme).
     *
     * Ici et non dans `rules()` : la regle depend d'un reglage, et le message doit
     * dire **laquelle des deux formes** est attendue. Un `required` generique
     * afficherait « le champ est requis » sur un champ que le client, s'il suit le
     * reglage, n'a meme pas montre.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $check): void {
            $policy = app(IdDocumentPolicy::class);

            if (!$policy->isRequired()) {
                return;
            }

            $rows = $this->input('passengers');
            $main = is_array($rows) ? ($rows[0] ?? null) : null;
            $main = is_array($main) ? $main : [];

            $image = $policy->mode() === IdDocumentPolicy::MODE_IMAGE;
            $field = $image ? 'id_document_path' : 'id_document_number';
            $value = $main[$field] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return;
            }

            $check->errors()->add(
                "passengers.0.{$field}",
                $image
                    ? 'Une photo de la pièce d’identité du voyageur principal est requise.'
                    : 'Le numéro de pièce d’identité du voyageur principal est requis.',
            );
        });
    }

    /**
     * L'en-tête est **obligatoire**.
     *
     * Sans elle, une requête qui expire côté réseau mais aboutit côté serveur
     * — banal sur une connexion mobile — pousse le client à réessayer, et le
     * passager se retrouve avec deux réservations et deux places immobilisées.
     */
    private function idempotencyKey(): string
    {
        $key = $this->header('Idempotency-Key');

        if (!is_string($key) || trim($key) === '') {
            throw ApiException::of(
                ErrorCode::ValidationFailed,
                'En-tête Idempotency-Key requise sur la création de réservation.',
            );
        }

        return trim($key);
    }
}
