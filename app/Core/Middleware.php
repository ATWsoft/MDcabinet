<?php

declare(strict_types=1);

namespace MDcabinet\Core;

interface Middleware
{
    /**
     * Return a Response to short-circuit the chain, or null to continue.
     */
    public function handle(Request $request): ?Response;
}
