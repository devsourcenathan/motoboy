<?php

declare(strict_types=1);

namespace App\Modules\Trips\Models;

use App\Modules\Agencies\Models\Agency;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Models\BookingPassenger;
use App\Modules\Fleet\Enums\SeatingMode;
use App\Modules\Fleet\Models\Driver;
use App\Modules\Fleet\Models\Vehicle;
use App\Modules\Identity\Models\User;
use App\Modules\Places\Models\City;
use App\Modules\Places\Models\Station;
use App\Modules\Routing\Models\Route;
use App\Modules\Routing\Models\Schedule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Départ daté.
 *
 * `origin_city_id` et `destination_city_id` sont **dénormalisés** depuis la
 * route : la recherche est la requête centrale du produit et filtre sur le
 * couple de villes, la jointure serait payée à chaque appel. C'est un
 * instantané, pas une redondance — la route d'un départ généré ne change plus.
 */
final class Trip extends Model
{
    protected $fillable = [
        'reference', 'agency_id', 'route_id', 'schedule_id',
        'origin_city_id', 'destination_city_id',
        'origin_station_id', 'destination_station_id',
        'departure_at', 'arrival_estimate_at', 'online_sales_close_at',
        'vehicle_id', 'driver_id', 'price', 'currency',
        'seating_mode', 'capacity', 'status',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'departure_at' => 'immutable_datetime',
        'arrival_estimate_at' => 'immutable_datetime',
        'online_sales_close_at' => 'immutable_datetime',
        'cancelled_at' => 'immutable_datetime',
        'seating_mode' => SeatingMode::class,
        'had_confirmed_bookings_at_cancellation' => 'boolean',
    ];

    /** @return BelongsTo<Agency, $this> */
    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    /** @return BelongsTo<Route, $this> */
    public function route(): BelongsTo
    {
        return $this->belongsTo(Route::class);
    }

    /** @return BelongsTo<Schedule, $this> */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    /** @return BelongsTo<City, $this> */
    public function originCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'origin_city_id');
    }

    /** @return BelongsTo<City, $this> */
    public function destinationCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'destination_city_id');
    }

    /** @return BelongsTo<Station, $this> */
    public function originStation(): BelongsTo
    {
        return $this->belongsTo(Station::class, 'origin_station_id');
    }

    /** @return BelongsTo<Station, $this> */
    public function destinationStation(): BelongsTo
    {
        return $this->belongsTo(Station::class, 'destination_station_id');
    }

    /** @return BelongsTo<Vehicle, $this> */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /** @return BelongsTo<Driver, $this> */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    /** @return BelongsTo<User, $this> */
    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /** @return HasMany<Booking, $this> */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /** @return HasMany<BookingPassenger, $this> */
    public function passengers(): HasMany
    {
        return $this->hasMany(BookingPassenger::class);
    }

    /**
     * Départs encore réservables en ligne.
     *
     * La fenêtre de vente se ferme 30 minutes avant le départ par défaut : sans
     * cette borne, une réservation resterait possible quelques secondes avant le
     * départ, alors que le passager ne peut matériellement pas s'y présenter et
     * que la liste d'embarquement est déjà établie (B2).
     *
     * @param Builder<$this> $query
     */
    public function scopeOpenForOnlineSale(Builder $query): void
    {
        $query->where('status', 'SCHEDULED')
            ->where('online_sales_close_at', '>', now());
    }

    /**
     * Ajoute `held_seats_count` — les places réellement immobilisées.
     *
     * **Une seule source de vérité pour les deux modes d'inventaire.** En mode
     * `CAPACITY`, `trips.seats_taken` existe uniquement comme garde-fou
     * d'écriture, adossé à la contrainte `seats_taken <= capacity` : compter des
     * lignes ne peut pas être contraint, d'où le compteur. Mais en **lecture**,
     * les lignes de `booking_passengers` font foi dans les deux modes, ce qui
     * évite deux chemins de calcul susceptibles de diverger.
     *
     * Une tenue expirée reste comptée tant que le job de libération n'est pas
     * passé — jusqu'à une minute d'indisponibilité fantôme, explicitement
     * acceptée en B2.
     *
     * @param Builder<$this> $query
     */
    public function scopeWithAvailability(Builder $query): void
    {
        $query->withCount([
            'passengers as held_seats_count' => fn (Builder $q) => $q->where('holds_seat', true),
        ]);
    }

    /**
     * Ne garde que les départs offrant assez de places pour le groupe entier :
     * une réservation de plusieurs places est prise en tout ou rien (B2).
     *
     * La sous-requête est répétée plutôt que reprise de `scopeWithAvailability`
     * parce que PostgreSQL n'autorise pas à référencer un alias du `SELECT`
     * dans un `WHERE` — ce n'est pas une duplication qu'on pourrait factoriser.
     *
     * @param Builder<$this> $query
     */
    public function scopeHavingSeatsFor(Builder $query, int $seats): void
    {
        $query->whereRaw(
            'trips.capacity - (
                select count(*) from booking_passengers bp
                where bp.trip_id = trips.id and bp.holds_seat = true
            ) >= ?',
            [$seats],
        );
    }
}
