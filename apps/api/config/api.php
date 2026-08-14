<?php

declare(strict_types=1);

return [

    /*
     * Documentation interactive du contrat, servie sur `/docs`.
     *
     * Ouverte par défaut, comme la plupart des API publiques : le contrat n'est
     * pas un secret, et le cacher n'empêche personne de découvrir les routes.
     * L'interrupteur existe pour le jour où cette lecture changerait.
     */
    'docs_enabled' => (bool) env('API_DOCS_ENABLED', true),

];
