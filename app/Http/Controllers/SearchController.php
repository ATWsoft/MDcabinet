<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Models\Document;
use MDcabinet\Support\Access;
use MDcabinet\Support\Presenter;

final class SearchController
{
    public function search(Request $request): Response
    {
        $userId = Auth::idOrFail();
        $query  = trim((string) $request->query('q', ''));

        if (mb_strlen($query, 'UTF-8') < 2) {
            return Response::json(['query' => $query, 'results' => []]);
        }

        $cabinetId = $request->query('cabinetId');
        if ($cabinetId !== null && $cabinetId !== '') {
            Access::cabinet((int) $cabinetId);
            $cabinetId = (int) $cabinetId;
        } else {
            $cabinetId = null;
        }

        $rows = Document::search($userId, $query, $cabinetId);

        $results = array_map(static function (array $row) use ($query): array {
            $item = Presenter::documentSummary($row);
            $item['score']     = $row['score'] ?? 0;
            $item['highlight'] = self::highlight((string) ($row['excerpt'] ?? ''), $query);

            return $item;
        }, $rows);

        return Response::json(['query' => $query, 'results' => $results]);
    }

    /** Marks the match inside the excerpt; the frontend renders it as <mark>. */
    private static function highlight(string $text, string $query): string
    {
        $needle = preg_quote($query, '/');
        $result = preg_replace('/(' . $needle . ')/iu', '«$1»', $text);

        return $result ?? $text;
    }
}
