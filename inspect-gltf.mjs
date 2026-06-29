import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(path.join(__dirname, 'node_modules/three/examples/jsm/libs/draco/'));
loader.setDRACOLoader(dracoLoader);

const glbPath = path.join(__dirname, 'src/assets/interior.glb');
const data = await fs.readFile(glbPath);

await new Promise((resolve, reject) => {
  loader.parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    path.join(__dirname, 'src/assets/') + '/',
    (gltf) => {
      const rows = [];
      gltf.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m) continue;
          rows.push({
            mesh: obj.name || '(unnamed-mesh)',
            material: m.name || '(unnamed-material)',
            map: Boolean(m.map),
            color: m.color?.getHexString?.() || 'n/a',
          });
        }
      });

      rows
        .sort((a, b) => a.mesh.localeCompare(b.mesh))
        .forEach((r) => {
          console.log(`${r.mesh} | ${r.material} | map=${r.map} color=${r.color}`);
        });
      resolve();
    },
    reject,
  );
});
