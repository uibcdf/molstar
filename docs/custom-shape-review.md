# MolSysViewer shape wiring review

This note cross-checks the proposed `widget.ts`/`shapes.ts` scaffolding against the
canonical Mol* 5.4.x patterns.

## 1. Plugin bootstrap (widget.ts)

* The proposal correctly instantiates a `PluginContext` and routes AnyWidget
  events into Mol* commands. The `createPlugin` helper you import should be the
  UI-less factory from `molstar/lib/mol-plugin-ui` (`createPluginUI` is the
  React helper). If you only need a bare plugin context, you can construct it by
  instantiating `PluginContext` with the default spec and calling
  `await plugin.initViewer({ canvas, container })`. This mirrors the setup used
  by the built-in UI bootstrapper in `src/mol-plugin-ui/index.ts`, which awaits
  initialization before rendering the viewer.【F:src/mol-plugin-ui/index.ts†L9-L25】

* Keep the message routing minimal inside `widget.ts`. Once shapes grow, follow
  the measurement manager pattern and have the widget call dedicated helpers in
  `shapes.ts` so that all state-tree logic stays contained there.【F:src/mol-plugin-state/manager/structure/measurement.ts†L67-L134】

## 2. Shape builders and representations (shapes.ts)

* The `MeshBuilder`/`Shape.create` approach you sketched is the modern way to
  generate procedural geometry. It matches the `StructureBoundingBox3D`
  transform, which uses `ShapeRepresentation` directly and reuses the previous
  mesh to avoid allocations.【F:src/mol-plugin-state/transforms/representation.ts†L1114-L1145】

* `ShapeRepresentation` instances expect their themes to come from
  `Shape.getColor/getSize`. Avoid `repr.setTheme`—the new measurement visuals
  demonstrate that you simply pass params to `createOrUpdate`, optionally merging
  new props before reusing the existing representation.【F:src/mol-plugin-state/transforms/representation.ts†L1152-L1208】

* To support per-sphere transparency, capture the `alpha` value in your shape
  data and then call `repr.setState({ alphaFactor: spec.alpha })` after the first
  `createOrUpdate`. This is the same hook the label transform uses to toggle
  pickability after updating props.【F:src/mol-plugin-state/transforms/representation.ts†L1259-L1286】

## 3. Custom state transformers

* Instead of `PluginStateTransform.Create`, define a namespaced transformer with
  `StateTransformer.builderFactory('molsysviewer')`. This mirrors the way
  extensions register their own transforms (for example, the interactions
  extension sets up `const Factory = StateTransformer.builderFactory('interactions-extension')`).【F:src/mol-state/transformer.ts†L190-L230】【F:src/extensions/interactions/transforms.ts†L1-L48】

* Using the builder keeps your transform serializable and avoids collisions with
  built-in IDs. Stick with `from: SO.Root` / `to: SO.Shape.Representation3D` for
  free-floating geometry, and include tags on the node so you can later select
  or delete all spheres with `StateSelection.findTagInSubtree` (again, mirroring
  the measurement manager).【F:src/mol-plugin-state/manager/structure/measurement.ts†L67-L134】

* The `apply`/`update` blocks can largely match `StructureBoundingBox3D`:
  construct the `TransparentSphereRepresentation` once, feed it data via
  `createOrUpdate`, and return `SO.Shape.Representation3D`. When updating, reuse
  `b.data.repr` and only rebuild the mesh if input data changed.【F:src/mol-plugin-state/transforms/representation.ts†L1114-L1179】

## 4. State updates, grouping, and cleanup

* Always go through `plugin.state.data.build()` + `PluginCommands.State.Update`
  when inserting spheres. This keeps undo/redo and snapshots functioning. The
  measurement manager shows how to create (or reuse) a group node, apply multiple
  transforms, and commit the transaction in one go.【F:src/mol-plugin-state/manager/structure/measurement.ts†L67-L134】

* For deletion, prefer `PluginCommands.State.RemoveObject` on the sphere's state
  ref. If you tagged the nodes, you can batch-select them via the `StateSelection`
  helpers before issuing the remove command.

With these adjustments, the proposed `addTransparentSphereFromPython` helper and
its transformer will align with the idioms Mol* itself uses for measurements,
bounding boxes, and extension-defined shapes.
