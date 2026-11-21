// Herramienta, no se carga en la web: regenera apps/mobile/assets/frasco-3d/frasco.glb.
// Exporta el frasco definitivo a glTF binario (.glb) para Blender y Android (Filament/SceneView).
// Metros reales (alto 0,22 m), origen en el cuello, Y arriba. Material PBR con
// KHR_materials_transmission + volume + ior + specular: Filament y Blender los leen.
import { Mesh, MeshPhysicalMaterial, Scene } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { crearGeometriaFrasco } from './geometria';
import { EXTERIOR } from './perfil-datos';

export async function exportarGLB(altoMetros = 0.22, segmentos = 128): Promise<ArrayBuffer> {
  const altoPx = EXTERIOR[EXTERIOR.length - 1]! - EXTERIOR[1]!;
  const k = altoMetros / altoPx;
  const g = crearGeometriaFrasco(segmentos);
  g.scale(k, k, k);
  // Hito 2: sin UV (el vidrio no lleva texturas): −25 % de peso, misma forma.
  g.deleteAttribute('uv');
  const material = new MeshPhysicalMaterial({
    name: 'Vidrio', color: 0xffffff, roughness: 0.015, metalness: 0, transmission: 1, ior: 1.5,
    thickness: 16 * k, attenuationColor: 0xeef5f7, attenuationDistance: 0.06, specularIntensity: 1,
  });
  const malla = new Mesh(g, material);
  malla.name = 'Frasco';
  const escena = new Scene();
  escena.add(malla);
  const salida = await new GLTFExporter().parseAsync(escena, { binary: true });
  g.dispose();
  material.dispose();
  return salida as ArrayBuffer;
}
