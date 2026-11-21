# Frasco 3D (modelo para Android)

`frasco.glb` es el mismo frasco que pinta la web (`apps/web/src/comun/frasco-3d`), hito 1 de Picasso.

- Alto 0,22 m, **origen en el cuello**, Y hacia arriba. La web solo exige que se respeten el origen en el cuello y la proporción de la foto (446×1024).
- Material PBR con transmission, volume e ior (KHR_materials_*), que leen Blender y Filament/SceneView.
- Sale del perfil `perfil-datos.ts` con `exportarGLB()` (`apps/web/src/comun/frasco-3d/exportar-gltf.ts`).
- Aún sin comprimir (unos 2 MB). Pendiente del hito 2: refinarlo en Blender y comprimirlo (meshopt o Draco) por debajo de 200 KB.

La app móvil todavía no lo usa: no está referenciado, así que no entra en el APK.
