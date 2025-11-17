import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { PluginStateObject as SO } from 'molstar/lib/mol-plugin-state/objects';
import { StateObjectRef, StateTransformer } from 'molstar/lib/mol-state';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { Task, RuntimeContext } from 'molstar/lib/mol-task';
import { Color } from 'molstar/lib/mol-util/color';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh';
import { MeshBuilder } from 'molstar/lib/mol-geo/geometry/mesh/mesh-builder';
import { addSphere } from 'molstar/lib/mol-geo/geometry/mesh/builder/sphere';
import { Shape } from 'molstar/lib/mol-model/shape';
import { ShapeRepresentation } from 'molstar/lib/mol-repr/shape/representation';
import { Representation, RepresentationContext, RepresentationParamsGetter } from 'molstar/lib/mol-repr/representation';

const MSVTransform = StateTransformer.builderFactory('molsysviewer');

export interface TransparentSphereSpec {
    center: [number, number, number];
    radius: number;
    color: number;
    alpha: number;
    id?: string;
}

interface TransparentSphereData {
    spheres: TransparentSphereSpec[];
}

const TransparentSphereParams = {
    ...Mesh.Params,
};
type TransparentSphereParams = typeof TransparentSphereParams;
type TransparentSphereProps = PD.Values<TransparentSphereParams>;

function buildSphereMesh(data: TransparentSphereData, _props: TransparentSphereProps, prev?: Mesh): Mesh {
    const state = MeshBuilder.createState(128, 64, prev);
    const detail = 2;

    for (let i = 0, il = data.spheres.length; i < il; i++) {
        const s = data.spheres[i];
        state.currentGroup = i;
        addSphere(state, Vec3.create(s.center[0], s.center[1], s.center[2]), s.radius, detail);
    }

    return MeshBuilder.getMesh(state);
}

function getTransparentSphereName(data: TransparentSphereData) {
    if (data.spheres.length === 0) return 'Transparent Sphere (empty)';
    if (data.spheres.length === 1) {
        const s = data.spheres[0];
        return s.id ? `Sphere ${s.id}` : 'Transparent Sphere';
    }
    return `${data.spheres.length} Transparent Spheres`;
}

function getTransparentSphereShape(
    _ctx: RuntimeContext,
    data: TransparentSphereData,
    _props: TransparentSphereProps,
    shape?: Shape<Mesh>
) {
    const mesh = buildSphereMesh(data, _props, shape?.geometry);
    const name = getTransparentSphereName(data);

    const getColor = (groupId: number) => Color(data.spheres[groupId].color);
    const getSize = (groupId: number) => data.spheres[groupId].radius;
    const getLabel = (groupId: number) => {
        const spec = data.spheres[groupId];
        const id = spec.id ?? `${groupId}`;
        return `Sphere ${id} (r = ${spec.radius.toFixed(2)})`;
    };

    return Shape.create(name, data, mesh, getColor, getSize, getLabel);
}

const TransparentSphereVisuals = {
    mesh: (
        _ctx: RepresentationContext,
        _getParams: RepresentationParamsGetter<TransparentSphereData, TransparentSphereParams>
    ) => ShapeRepresentation(getTransparentSphereShape, Mesh.Utils),
};

export const TransparentSphereShapeParams = {
    ...TransparentSphereParams,
};
export type TransparentSphereShapeParams = typeof TransparentSphereShapeParams;
export type TransparentSphereShapeProps = PD.Values<TransparentSphereShapeParams>;

export type TransparentSphereRepresentation = Representation<TransparentSphereData, TransparentSphereShapeParams>;

export function TransparentSphereRepresentation(
    ctx: RepresentationContext,
    getParams: RepresentationParamsGetter<TransparentSphereData, TransparentSphereShapeParams>
): TransparentSphereRepresentation {
    return Representation.createMulti(
        'TransparentSpheres',
        ctx,
        getParams,
        Representation.StateBuilder,
        TransparentSphereVisuals as unknown as Representation.Def<TransparentSphereData, TransparentSphereShapeParams>
    );
}

export const TransparentSphere3D = MSVTransform({
    name: 'molsysviewer-transparent-sphere-3d',
    display: { name: 'Transparent Sphere' },
    from: SO.Root,
    to: SO.Shape.Representation3D,
    params: {
        center: PD.Vec3(Vec3.create(0, 0, 0), { isEssential: true }),
        radius: PD.Numeric(1, { min: 0.01, max: 1000, step: 0.01 }, { isEssential: true }),
        color: PD.Color(ColorNames.green, { isEssential: true }),
        alpha: PD.Numeric(0.4, { min: 0, max: 1, step: 0.01 }, { isEssential: true }),
    },
})({
    canAutoUpdate() {
        return true;
    },
    apply({ params }, plugin: PluginContext) {
        return Task.create('Transparent Sphere', async ctx => {
            const data: TransparentSphereData = {
                spheres: [
                    {
                        center: [params.center[0], params.center[1], params.center[2]],
                        radius: params.radius,
                        color: params.color,
                        alpha: params.alpha,
                        id: 'sphere-0',
                    },
                ],
            };

            const repr = TransparentSphereRepresentation(
                { webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes },
                () => TransparentSphereShapeParams
            );

            const props: TransparentSphereShapeProps = {
                ...PD.getDefaultValues(TransparentSphereShapeParams),
            };

            await repr.createOrUpdate(props, data).runInContext(ctx);

            repr.setState({ alphaFactor: params.alpha });

            return new SO.Shape.Representation3D({ repr, sourceData: data }, { label: 'Transparent Sphere' });
        });
    },
    update({ b, newParams }, plugin: PluginContext) {
        return Task.create('Transparent Sphere', async ctx => {
            const data: TransparentSphereData = {
                spheres: [
                    {
                        center: [newParams.center[0], newParams.center[1], newParams.center[2]],
                        radius: newParams.radius,
                        color: newParams.color,
                        alpha: newParams.alpha,
                        id: 'sphere-0',
                    },
                ],
            };

            const props = { ...b.data.repr.props };
            await b.data.repr.createOrUpdate(props, data).runInContext(ctx);
            b.data.repr.setState({ alphaFactor: newParams.alpha });
            b.data.sourceData = data;
            return StateTransformer.UpdateResult.Updated;
        });
    },
});

export async function addTransparentSphereFromPython(
    plugin: PluginContext,
    spec: TransparentSphereSpec
): Promise<StateObjectRef<SO.Shape.Representation3D>> {
    const centerVec = Vec3.create(spec.center[0], spec.center[1], spec.center[2]);

    const builder = plugin.state.data.build();
    const sphere = builder.toRoot().apply(
        TransparentSphere3D,
        {
            center: centerVec,
            radius: spec.radius,
            color: spec.color,
            alpha: spec.alpha,
        } as any,
        { tags: 'molsysviewer:spheres' }
    );

    await PluginCommands.State.Update(plugin, {
        state: plugin.state.data,
        tree: builder,
        options: { doNotLogTiming: true },
    });

    return sphere.ref;
}
