import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';

import { addTransparentSphereFromPython } from './shapes';
import { loadStructureFromString } from './structure';

export async function createMolSysViewer(target: HTMLElement): Promise<PluginContext> {
    const plugin = new PluginContext(DefaultPluginSpec());

    await plugin.mountAsync(target);
    await plugin.canvas3dInitialized;

    return plugin;
}

type TransparentSphereMessage = {
    op: 'test_transparent_sphere';
    options?: {
        center?: [number, number, number];
        radius?: number;
        color?: number;
        alpha?: number;
    };
};

type LoadStructureMessage = {
    op: 'load_pdb_string';
    pdb?: string;
    pdb_text?: string;
};

type ViewerMessage = TransparentSphereMessage | LoadStructureMessage | Record<string, unknown>;

export default {
    render({ model, el }: { model: any; el: HTMLElement }) {
        const pluginPromise = createMolSysViewer(el);

        model.on('msg:custom', async (msg: ViewerMessage) => {
            if (!msg || typeof msg !== 'object') return;
            const plugin = await pluginPromise;

            switch (msg.op) {
                case 'load_pdb_string': {
                    const pdb = msg.pdb ?? msg.pdb_text ?? '';
                    if (!pdb) return;
                    await loadStructureFromString(plugin, pdb);
                    break;
                }
                case 'test_transparent_sphere': {
                    const options = msg.options ?? {};
                    await addTransparentSphereFromPython(plugin, {
                        center: options.center ?? [0, 0, 0],
                        radius: options.radius ?? 10,
                        color: options.color ?? 0x00ff00,
                        alpha: options.alpha ?? 0.4,
                    });
                    break;
                }
                default:
                    break;
            }
        });
    },
};
