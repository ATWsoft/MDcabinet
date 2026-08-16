<?php

declare(strict_types=1);

namespace MDcabinet\Core;

interface Middleware
{
    /**
     * Vráť Response na prerušenie reťazca, alebo null na pokračovanie.
     */
    public function handle(Request $request): ?Response;
}
