import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useProgress } from "@react-three/drei";
import {
  Physics,
  RigidBody,
  CapsuleCollider,
  CuboidCollider,
} from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import interiorModelUrl from "./assets/interior.glb?url";
import "./App.css";

const UP = new THREE.Vector3(0, 1, 0);
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpVelocity = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const INITIAL_LOOK = { yaw: 0, pitch: 0 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const COLLISION_OBJECT_NAMES = [
  "ceiling",
  "floor",
  "frontwall",
  "backwall",
  "leftwall",
  "rightwall",
  "bedback",
  "closet",
  "verticalblinds",
  "curtains_color",
  "carpet",
];

function RoomGeometry({ onReady, isTouch }) {
  const { scene } = useGLTF(interiorModelUrl);
  const bounds = useMemo(
    () => new THREE.Box3().setFromObject(scene, true),
    [scene],
  );
  const roomCenter = useMemo(
    () => bounds.getCenter(new THREE.Vector3()),
    [bounds],
  );
  const roomSize = useMemo(() => bounds.getSize(new THREE.Vector3()), [bounds]);

  const boundaryColliders = useMemo(() => {
    if (bounds.isEmpty()) {
      return [];
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bounds.getCenter(center);
    bounds.getSize(size);

    const thickness = 0.2;
    const halfX = Math.max(size.x * 0.5, 0.5);
    const halfY = Math.max(size.y * 0.5, 0.8);
    const halfZ = Math.max(size.z * 0.5, 0.5);
    const halfT = thickness * 0.5;

    return [
      {
        key: "bounds-left",
        position: [bounds.min.x - halfT, center.y, center.z],
        halfExtents: [halfT, halfY, halfZ + thickness],
      },
      {
        key: "bounds-right",
        position: [bounds.max.x + halfT, center.y, center.z],
        halfExtents: [halfT, halfY, halfZ + thickness],
      },
      {
        key: "bounds-back",
        position: [center.x, center.y, bounds.max.z + halfT],
        halfExtents: [halfX + thickness, halfY, halfT],
      },
      {
        key: "bounds-front",
        position: [center.x, center.y, bounds.min.z - halfT],
        halfExtents: [halfX + thickness, halfY, halfT],
      },
    ];
  }, [scene]);

  const collisionBoxes = useMemo(() => {
    const boxes = [];
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    scene.traverse((child) => {
      if (!child.isMesh) {
        return;
      }

      const meshName = child.name.toLowerCase();
      const isBoundaryMesh = COLLISION_OBJECT_NAMES.some((name) =>
        meshName.includes(name),
      );

      if (!isBoundaryMesh) {
        return;
      }

      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox();
      }

      const localBounds = child.geometry.boundingBox;
      if (!localBounds) {
        return;
      }

      localBounds.getCenter(center);
      localBounds.getSize(size);

      child.updateWorldMatrix(true, false);
      center.applyMatrix4(child.matrixWorld);
      child.getWorldScale(scale);
      child.getWorldQuaternion(quaternion);

      size.set(
        Math.abs(size.x * scale.x),
        Math.abs(size.y * scale.y),
        Math.abs(size.z * scale.z),
      );

      if (size.x < 0.01 || size.y < 0.01 || size.z < 0.01) {
        return;
      }

      boxes.push({
        key: child.uuid,
        position: [center.x, center.y, center.z],
        halfExtents: [size.x * 0.5, size.y * 0.5, size.z * 0.5],
        rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      });
    });

    return boxes;
  }, [scene]);

  useEffect(() => {
    let sharedSilverMaterial = null;

    scene.traverse((child) => {
      if (!child.isMesh || sharedSilverMaterial) {
        return;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (!material || sharedSilverMaterial) {
          return;
        }

        const materialName = material.name?.toLowerCase?.() ?? "";
        if (materialName.includes("scratched silver metal")) {
          sharedSilverMaterial = material;
        }
      });
    });

    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const meshName = child.name?.toLowerCase?.() ?? "";
        const isLampBulbMesh = meshName === "sphere";
        const isPendantConeMesh =
          meshName === "cone" || meshName.includes("ceilinglamp");

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        const nextMaterials = materials.map((material) => {
          if (!material) {
            return material;
          }

          const materialName = material.name?.toLowerCase?.() ?? "";
          const isLampBulbMaterial = materialName.includes("light material");
          const shouldUseLampOverride = isLampBulbMaterial || isLampBulbMesh;
          const shouldUsePendantOverride =
            isPendantConeMesh && Boolean(sharedSilverMaterial);
          const activeMaterial = shouldUsePendantOverride
            ? sharedSilverMaterial.clone()
            : shouldUseLampOverride
              ? material.clone()
              : material;

          const textureMaps = [
            activeMaterial.map,
            activeMaterial.emissiveMap,
            activeMaterial.aoMap,
            activeMaterial.metalnessMap,
            activeMaterial.roughnessMap,
            activeMaterial.normalMap,
            activeMaterial.alphaMap,
            activeMaterial.bumpMap,
          ];

          textureMaps.forEach((texture) => {
            if (!texture) {
              return;
            }

            texture.flipY = false;
            texture.needsUpdate = true;
          });

          if (activeMaterial.map) {
            activeMaterial.map.colorSpace = THREE.SRGBColorSpace;
          }

          if (activeMaterial.emissiveMap) {
            activeMaterial.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          }

          if (shouldUseLampOverride) {
            activeMaterial.color = new THREE.Color("#f4e2b8");
            activeMaterial.emissive = new THREE.Color("#ffdca0");
            activeMaterial.emissiveIntensity = 1.35;
            activeMaterial.metalness = 0.05;
            activeMaterial.roughness = 0.35;
          }

          activeMaterial.shadowSide = THREE.DoubleSide;
          activeMaterial.needsUpdate = true;

          return activeMaterial;
        });

        child.material = Array.isArray(child.material)
          ? nextMaterials
          : nextMaterials[0];
      }
    });

    onReady?.();
  }, [scene, onReady]);

  return (
    <>
      <ambientLight intensity={0.14} />
      <spotLight
        position={[
          roomCenter.x - roomSize.x * 0.65,
          roomCenter.y + roomSize.y * 0.75,
          roomCenter.z + roomSize.z * 0.18,
        ]}
        angle={0.58}
        intensity={220}
        penumbra={0.8}
        distance={28}
        decay={1.7}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />
      <directionalLight
        position={[
          roomCenter.x + roomSize.x * 0.45,
          roomCenter.y + roomSize.y * 0.85,
          roomCenter.z + roomSize.z * 0.55,
        ]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.00015}
        shadow-normalBias={0.04}
      />

      <pointLight
        position={[
          roomCenter.x - roomSize.x * 0.18,
          roomCenter.y + roomSize.y * 0.62,
          roomCenter.z - roomSize.z * 0.22,
        ]}
        intensity={1.4}
        distance={10}
        decay={2}
      />

      <primitive object={scene} />

      <RigidBody type="fixed" colliders={false}>
        {collisionBoxes.map((box) => (
          <CuboidCollider
            key={box.key}
            position={box.position}
            args={box.halfExtents}
            rotation={box.rotation}
          />
        ))}

        {boundaryColliders.map((box) => (
          <CuboidCollider
            key={box.key}
            position={box.position}
            args={box.halfExtents}
          />
        ))}
      </RigidBody>
    </>
  );
}

function LoadingOverlay({ visible }) {
  const { progress } = useProgress();
  const value = Math.round(progress);

  return (
    <div className={`loading-overlay ${visible ? "visible" : ""}`}>
      <p>Loading 3D scene...</p>
      <div className="loading-bar">
        <span style={{ width: `${value}%` }} />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}

function Player({ moveRef, lookRef, spawn }) {
  const bodyRef = useRef(null);
  const smoothVelocityRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!bodyRef.current) {
      return;
    }

    bodyRef.current.setTranslation(
      { x: spawn[0], y: spawn[1], z: spawn[2] },
      true,
    );
    bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }, [spawn]);

  useFrame(({ camera }, delta) => {
    if (!bodyRef.current) {
      return;
    }

    const look = lookRef.current;
    const move = moveRef.current;

    camera.quaternion.setFromEuler(
      new THREE.Euler(look.pitch, look.yaw, 0, "YXZ"),
    );

    // Use the camera's real orientation to avoid sideways drift after rotation.
    tmpForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    tmpForward.y = 0;
    tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, UP).normalize();

    const moveZ = Number(move.forward) - Number(move.back);
    const moveX = Number(move.right) - Number(move.left);
    const hasInput = moveZ !== 0 || moveX !== 0;

    tmpVelocity
      .copy(tmpForward)
      .multiplyScalar(moveZ)
      .addScaledVector(tmpRight, moveX);

    const speed = 1.85;
    if (tmpVelocity.lengthSq() > 1) {
      tmpVelocity.normalize();
    }
    tmpVelocity.multiplyScalar(speed);

    const movementDamping = hasInput ? 20 : 12;
    const movementAlpha = 1 - Math.exp(-movementDamping * delta);
    smoothVelocityRef.current.lerp(tmpVelocity, movementAlpha);

    bodyRef.current.setLinvel(
      {
        x: smoothVelocityRef.current.x,
        y: 0,
        z: smoothVelocityRef.current.z,
      },
      true,
    );

    const p = bodyRef.current.translation();
    tmpTarget.set(p.x, p.y + 0.62, p.z);
    camera.position.copy(tmpTarget);
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={spawn}
      colliders={false}
      lockRotations
      linearDamping={8}
      angularDamping={8}
      canSleep={false}
      additionalSolverIterations={4}
      ccd
    >
      <CapsuleCollider args={[0.32, 0.22]} />
    </RigidBody>
  );
}

function ControlButton({ label, onStart, onEnd, className }) {
  return (
    <button
      type="button"
      className={className}
      onPointerDown={(event) => {
        event.preventDefault();
        onStart();
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        onEnd();
      }}
      onPointerCancel={onEnd}
      onPointerLeave={onEnd}
    >
      {label}
    </button>
  );
}

function App() {
  const containerRef = useRef(null);
  const lookPadRef = useRef(null);
  const dragStartRef = useRef(null);
  const lookRef = useRef({ ...INITIAL_LOOK });
  const moveRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
  });
  const spawn = [-0.57, 1.2, 1.2];

  const [isTouch, setIsTouch] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const canvasDpr = [1, 1.1];

  const updateLook = (deltaX, deltaY, sensitivity) => {
    const safeDeltaX = clamp(deltaX, -40, 40);
    const safeDeltaY = clamp(deltaY, -40, 40);

    lookRef.current.yaw -= safeDeltaX * sensitivity;
    lookRef.current.pitch = clamp(
      lookRef.current.pitch - safeDeltaY * sensitivity,
      -1.2,
      1.2,
    );
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateDeviceType = () => {
      setIsTouch(mediaQuery.matches || navigator.maxTouchPoints > 0);
    };

    updateDeviceType();
    mediaQuery.addEventListener("change", updateDeviceType);

    return () => {
      mediaQuery.removeEventListener("change", updateDeviceType);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) {
        return;
      }

      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          moveRef.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          moveRef.current.back = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveRef.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          moveRef.current.right = true;
          break;
        default:
          break;
      }
    };

    const onKeyUp = (event) => {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          moveRef.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          moveRef.current.back = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveRef.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          moveRef.current.right = false;
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === containerRef.current;
      setIsLocked(locked);

      if (!locked) {
        moveRef.current.forward = false;
        moveRef.current.back = false;
        moveRef.current.left = false;
        moveRef.current.right = false;
      }
    };

    const onMouseMove = (event) => {
      if (document.pointerLockElement !== containerRef.current) {
        return;
      }

      updateLook(event.movementX, event.movementY, 0.0022);
    };

    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  const setMoveFlag = (key, value) => {
    if (isTouch && value) {
      setHudCollapsed(true);
    }

    moveRef.current[key] = value;
  };

  const onLookPadDown = (event) => {
    event.preventDefault();

    if (isTouch) {
      setHudCollapsed(true);
    }

    dragStartRef.current = { x: event.clientX, y: event.clientY };
    lookPadRef.current?.setPointerCapture(event.pointerId);
  };

  const onLookPadMove = (event) => {
    if (!dragStartRef.current) {
      return;
    }

    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    updateLook(deltaX, deltaY, 0.005);
  };

  const onLookPadUp = (event) => {
    dragStartRef.current = null;
    lookPadRef.current?.releasePointerCapture(event.pointerId);
  };

  const requestLock = () => {
    if (!containerRef.current || isTouch) {
      return;
    }

    containerRef.current.requestPointerLock();
  };

  const unlockPointer = () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  const onScenePointerDown = () => {
    if (isTouch || isLocked) {
      return;
    }

    requestLock();
  };

  const onSceneReady = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSceneReady(true);
      });
    });
  };

  const onHudTogglePointerDown = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={containerRef}
      className="app-shell"
      onPointerDown={onScenePointerDown}
      onDoubleClick={unlockPointer}
    >
      <Canvas
        shadows
        dpr={canvasDpr}
        gl={{
          antialias: !isTouch,
          powerPreference: isTouch ? "low-power" : "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        camera={{ fov: 75, near: 0.1, far: 30, position: [-0.57, 1.2, 1.2] }}
      >
        <color attach="background" args={["#efe8db"]} />
        <fog attach="fog" args={["#efe8db", 8, 20]} />
        <Physics gravity={[0, 0, 0]}>
          <Suspense fallback={null}>
            <RoomGeometry onReady={onSceneReady} isTouch={isTouch} />
          </Suspense>
          <Player moveRef={moveRef} lookRef={lookRef} spawn={spawn} />
        </Physics>
      </Canvas>

      <LoadingOverlay visible={!sceneReady} />

      <section className={`hud ${hudCollapsed ? "hidden" : ""}`}>
        <button
          type="button"
          className="hud-toggle"
          onPointerDown={onHudTogglePointerDown}
          onClick={() => setHudCollapsed(true)}
          aria-label="Close navigation help"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" />
          </svg>
        </button>
        <h1>Interior Walkthrough</h1>
        <p>Desktop: click scene + W A S D</p>
        <p>Desktop: press ESC to show cursor and leave control</p>
        <p>Mobile: touch buttons + drag look pad</p>
        <p>Mobile: no ESC needed</p>
      </section>

      {hudCollapsed && (
        <button
          type="button"
          className="hud-reopen"
          onPointerDown={onHudTogglePointerDown}
          onClick={() => setHudCollapsed(false)}
          aria-label="Show navigation help"
        >
          ?
        </button>
      )}

      {!isTouch && isLocked && (
        <section className="desktop-actions">
          <button type="button" onClick={unlockPointer}>
            Exit
          </button>
          <span className="desktop-tip">Press ESC anytime</span>
        </section>
      )}

      {isTouch && (
        <section className="mobile-controls">
          <div className="movement-pad">
            <ControlButton
              className="btn up"
              label="W"
              onStart={() => setMoveFlag("forward", true)}
              onEnd={() => setMoveFlag("forward", false)}
            />
            <ControlButton
              className="btn left"
              label="A"
              onStart={() => setMoveFlag("left", true)}
              onEnd={() => setMoveFlag("left", false)}
            />
            <ControlButton
              className="btn down"
              label="S"
              onStart={() => setMoveFlag("back", true)}
              onEnd={() => setMoveFlag("back", false)}
            />
            <ControlButton
              className="btn right"
              label="D"
              onStart={() => setMoveFlag("right", true)}
              onEnd={() => setMoveFlag("right", false)}
            />
          </div>

          <div
            ref={lookPadRef}
            className="look-pad"
            onPointerDown={onLookPadDown}
            onPointerMove={onLookPadMove}
            onPointerUp={onLookPadUp}
            onPointerCancel={onLookPadUp}
          >
            <span>Drag to look</span>
          </div>
        </section>
      )}
    </div>
  );
}

useGLTF.preload(interiorModelUrl);

export default App;
