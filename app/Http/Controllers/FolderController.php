<?php

declare(strict_types=1);

namespace MDcabinet\Http\Controllers;

use MDcabinet\Core\HttpException;
use MDcabinet\Core\Lang;
use MDcabinet\Core\Request;
use MDcabinet\Core\Response;
use MDcabinet\Core\Validator;
use MDcabinet\Models\Folder;
use MDcabinet\Support\Access;
use MDcabinet\Support\Presenter;

final class FolderController
{
    public function store(Request $request): Response
    {
        $data = Validator::check($request->all(), [
            'trayId'   => 'required|int',
            'parentId' => 'nullable|int',
            'name'     => 'required|string|min:1|max:190',
        ]);

        $tray     = Access::tray((int) $data['trayId']);
        $parentId = isset($data['parentId']) && $data['parentId'] !== null ? (int) $data['parentId'] : null;

        if ($parentId !== null) {
            $parent = Access::folder($parentId);
            if ((int) $parent['tray_id'] !== (int) $tray['id']) {
                throw HttpException::badRequest(Lang::t('The parent folder belongs to a different tray.'));
            }
            if (Folder::depth($parentId) + 1 >= Folder::MAX_DEPTH) {
                throw HttpException::badRequest(Lang::t('Folders can be nested at most {depth} levels deep.', ['depth' => Folder::MAX_DEPTH]));
            }
        }

        $id = Folder::create([
            'tray_id'   => (int) $tray['id'],
            'parent_id' => $parentId,
            'name'      => $data['name'],
            'slug'      => Folder::uniqueSlug($data['name'], ['tray_id' => (int) $tray['id']]),
            'position'  => Folder::nextPosition(['tray_id' => (int) $tray['id'], 'parent_id' => $parentId]),
        ]);

        return Response::json(['folder' => Presenter::folder(Folder::find($id) ?? [])], 201);
    }

    public function update(Request $request): Response
    {
        $folder = Access::folder($request->paramInt('id'));

        $data = Validator::check($request->all(), [
            'name' => 'required|string|min:1|max:190',
        ]);

        Folder::update((int) $folder['id'], [
            'name' => $data['name'],
            'slug' => Folder::uniqueSlug($data['name'], ['tray_id' => (int) $folder['tray_id']], (int) $folder['id']),
        ]);

        return Response::json(['folder' => Presenter::folder(Folder::find((int) $folder['id']) ?? [])]);
    }

    /** Moves a folder under a different parent (or to the tray root). */
    public function move(Request $request): Response
    {
        $folder = Access::folder($request->paramInt('id'));

        $data = Validator::check($request->all(), [
            'parentId' => 'nullable|int',
        ]);

        $parentId = isset($data['parentId']) && $data['parentId'] !== null ? (int) $data['parentId'] : null;

        if ($parentId !== null) {
            $parent = Access::folder($parentId);

            if ((int) $parent['tray_id'] !== (int) $folder['tray_id']) {
                throw HttpException::badRequest(Lang::t('Moving between trays is not supported yet.'));
            }
            if (Folder::isDescendantOf($parentId, (int) $folder['id'])) {
                throw HttpException::badRequest(Lang::t('A folder cannot be moved into itself.'));
            }
        }

        Folder::update((int) $folder['id'], [
            'parent_id' => $parentId,
            'position'  => Folder::nextPosition(['tray_id' => (int) $folder['tray_id'], 'parent_id' => $parentId]),
        ]);

        return Response::json(['folder' => Presenter::folder(Folder::find((int) $folder['id']) ?? [])]);
    }

    public function destroy(Request $request): Response
    {
        $folder = Access::folder($request->paramInt('id'));
        Folder::softDelete((int) $folder['id']);

        return Response::json(['ok' => true]);
    }
}
