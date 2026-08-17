<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Auth;
use MDcabinet\Core\Database;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Cabinet;
use MDcabinet\Models\Document;
use MDcabinet\Support\Access;
use MDcabinet\Support\Presenter;

final class CabinetController
{
    public function index(Request $request): Response
    {
        $userId = Auth::idOrFail();

        return Response::json([
            'cabinets' => array_map([Presenter::class, 'cabinet'], Cabinet::allForUser($userId)),
        ]);
    }

    /** Dashboard: cabinets plus the most recently edited documents. */
    public function dashboard(Request $request): Response
    {
        $userId = Auth::idOrFail();

        return Response::json([
            'cabinets' => array_map([Presenter::class, 'cabinet'], Cabinet::allForUser($userId)),
            'recent'   => array_map([Presenter::class, 'documentSummary'], Document::recentForUser($userId, 12)),
        ]);
    }

    public function show(Request $request): Response
    {
        $cabinet = Access::cabinet($request->paramInt('id'));
        $tree    = Cabinet::tree((int) $cabinet['id']);

        return Response::json(['cabinet' => Presenter::cabinet($tree)]);
    }

    public function store(Request $request): Response
    {
        $userId = Auth::idOrFail();

        $data = Validator::check($request->all(), [
            'name'        => 'required|string|min:1|max:190',
            'description' => 'nullable|string|max:2000',
            'color'       => 'nullable|string|max:7',
            'icon'        => 'nullable|string|max:48',
        ]);

        $id = Cabinet::create([
            'owner_id'    => $userId,
            'name'        => $data['name'],
            'slug'        => Cabinet::uniqueSlug($data['name'], ['owner_id' => $userId]),
            'description' => $data['description'] ?? null,
            'color'       => $this->color($data['color'] ?? null),
            'icon'        => $data['icon'] ?? null,
            'position'    => Cabinet::nextPosition(['owner_id' => $userId]),
        ]);

        return Response::json(['cabinet' => Presenter::cabinet(Cabinet::find($id) ?? [])], 201);
    }

    public function update(Request $request): Response
    {
        $cabinet = Access::cabinet($request->paramInt('id'));

        $data = Validator::check($request->all(), [
            'name'        => 'nullable|string|min:1|max:190',
            'description' => 'nullable|string|max:2000',
            'color'       => 'nullable|string|max:7',
            'icon'        => 'nullable|string|max:48',
        ]);

        $update = [];
        if (!empty($data['name'])) {
            $update['name'] = $data['name'];
            $update['slug'] = Cabinet::uniqueSlug(
                $data['name'],
                ['owner_id' => (int) $cabinet['owner_id']],
                (int) $cabinet['id']
            );
        }
        foreach (['description' => 'description', 'icon' => 'icon'] as $field => $column) {
            if (array_key_exists($field, $data)) {
                $update[$column] = $data[$field];
            }
        }
        if (!empty($data['color'])) {
            $update['color'] = $this->color($data['color']);
        }

        Cabinet::update((int) $cabinet['id'], $update);

        return Response::json(['cabinet' => Presenter::cabinet(Cabinet::find((int) $cabinet['id']) ?? [])]);
    }

    public function destroy(Request $request): Response
    {
        $cabinet = Access::cabinet($request->paramInt('id'));
        Cabinet::softDelete((int) $cabinet['id']);

        return Response::json(['ok' => true]);
    }

    public function reorder(Request $request): Response
    {
        $userId = Auth::idOrFail();
        $ids    = $request->input('ids', []);

        if (!is_array($ids)) {
            return Response::json(['ok' => false], 422);
        }

        Database::transaction(static function () use ($ids, $userId): void {
            foreach (array_values($ids) as $position => $id) {
                Database::update('cabinets', ['position' => $position], [
                    'id'       => (int) $id,
                    'owner_id' => $userId,
                ]);
            }
        });

        return Response::json(['ok' => true]);
    }

    private function color(?string $value): string
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value)
            ? strtolower($value)
            : '#6366f1';
    }
}
