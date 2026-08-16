<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\Database;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Document;
use MDcabinet\Models\Folder;
use MDcabinet\Models\Tray;
use MDcabinet\Support\Access;
use MDcabinet\Support\Presenter;

final class TrayController
{
    public function show(Request $request): Response
    {
        $tray = Access::tray($request->paramInt('id'));

        $folders   = Folder::allForTray((int) $tray['id']);
        $documents = Document::listForTrays([(int) $tray['id']]);

        $tray['folders']   = Folder::buildTree($folders, $documents);
        $tray['documents'] = array_values(array_filter($documents, static fn ($d) => $d['folder_id'] === null));

        return Response::json(['tray' => Presenter::tray($tray)]);
    }

    public function store(Request $request): Response
    {
        $data = Validator::check($request->all(), [
            'cabinetId'   => 'required|int',
            'name'        => 'required|string|min:1|max:190',
            'description' => 'nullable|string|max:2000',
            'icon'        => 'nullable|string|max:48',
        ]);

        $cabinet = Access::cabinet((int) $data['cabinetId']);

        $id = Tray::create([
            'cabinet_id'  => (int) $cabinet['id'],
            'name'        => $data['name'],
            'slug'        => Tray::uniqueSlug($data['name'], ['cabinet_id' => (int) $cabinet['id']]),
            'description' => $data['description'] ?? null,
            'icon'        => $data['icon'] ?? null,
            'position'    => Tray::nextPosition(['cabinet_id' => (int) $cabinet['id']]),
        ]);

        return Response::json(['tray' => Presenter::tray(Tray::find($id) ?? [])], 201);
    }

    public function update(Request $request): Response
    {
        $tray = Access::tray($request->paramInt('id'));

        $data = Validator::check($request->all(), [
            'name'        => 'nullable|string|min:1|max:190',
            'description' => 'nullable|string|max:2000',
            'icon'        => 'nullable|string|max:48',
        ]);

        $update = [];
        if (!empty($data['name'])) {
            $update['name'] = $data['name'];
            $update['slug'] = Tray::uniqueSlug(
                $data['name'],
                ['cabinet_id' => (int) $tray['cabinet_id']],
                (int) $tray['id']
            );
        }
        foreach (['description', 'icon'] as $field) {
            if (array_key_exists($field, $data)) {
                $update[$field] = $data[$field];
            }
        }

        Tray::update((int) $tray['id'], $update);

        return Response::json(['tray' => Presenter::tray(Tray::find((int) $tray['id']) ?? [])]);
    }

    public function destroy(Request $request): Response
    {
        $tray = Access::tray($request->paramInt('id'));
        Tray::softDelete((int) $tray['id']);

        return Response::json(['ok' => true]);
    }

    public function reorder(Request $request): Response
    {
        $cabinet = Access::cabinet($request->int('cabinetId'));
        $ids     = $request->input('ids', []);

        if (!is_array($ids)) {
            return Response::json(['ok' => false], 422);
        }

        Database::transaction(static function () use ($ids, $cabinet): void {
            foreach (array_values($ids) as $position => $id) {
                Database::update('trays', ['position' => $position], [
                    'id'         => (int) $id,
                    'cabinet_id' => (int) $cabinet['id'],
                ]);
            }
        });

        return Response::json(['ok' => true]);
    }
}
