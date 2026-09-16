import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#studio-canvas');
const revealSlider = document.querySelector('#reveal-slider');
const viewer = document.querySelector('.viewer');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dce7e1');

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 1.7, 17);

const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 11;
controls.maxDistance = 24;
controls.target.set(0, 1.2, 0);

const ambientLight = new THREE.HemisphereLight('#fff8ef', '#6b8179', 2.1);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight('#fff8ef', 3.2);
keyLight.position.set(-5, 8, 8);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight('#94b9c2', 1.7);
rimLight.position.set(6, 2, -6);
scene.add(rimLight);

const handRoot = new THREE.Group();
handRoot.rotation.y = Math.PI * 0.04;
scene.add(handRoot);

const layers = [
	{ name: 'Skin', color: '#c98270', group: new THREE.Group() },
	{ name: 'Muscle', color: '#8f4037', group: new THREE.Group() },
	{ name: 'Ligaments', color: '#c3a15a', group: new THREE.Group() },
	{ name: 'Bones', color: '#ded6c5', group: new THREE.Group() },
	{ name: 'Veins', color: '#3a608d', group: new THREE.Group() },
	{ name: 'Tendons', color: '#c8b99b', group: new THREE.Group() },
	{ name: 'Nerves', color: '#c5aa47', group: new THREE.Group() },
	{ name: 'Arteries', color: '#9f3e3b', group: new THREE.Group() },
	{ name: 'Fascia', color: '#9a8db0', group: new THREE.Group() },
];

layers.forEach(({ group }) => handRoot.add(group));

function material(color, roughness = 0.55, metalness = 0, clearcoat = 0) {
	return new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat, clearcoatRoughness: 0.35 });
}

function addSphere(group, position, scale, surfaceMaterial) {
	const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), surfaceMaterial);
	mesh.position.set(...position);
	mesh.scale.set(...scale);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add(mesh);
	return mesh;
}

function addCapsule(group, position, radius, length, surfaceMaterial, rotation = [0, 0, 0]) {
	const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 12, 24), surfaceMaterial);
	mesh.position.set(...position);
	mesh.rotation.set(...rotation);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add(mesh);
	return mesh;
}

function addBone(group, start, end, radius, surfaceMaterial) {
	const startVector = new THREE.Vector3(...start);
	const endVector = new THREE.Vector3(...end);
	const direction = endVector.clone().sub(startVector);
	const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, direction.length(), 10, 20), surfaceMaterial);
	mesh.position.copy(startVector.clone().add(endVector).multiplyScalar(0.5));
	mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add(mesh);
	return mesh;
}

function addTube(group, points, radius, surfaceMaterial) {
	const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
	const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 12, false), surfaceMaterial);
	mesh.castShadow = true;
	group.add(mesh);
	return mesh;
}

function createSkin() {
	const skin = material('#c98270', 0.68, 0, 0.12);
	addSphere(layers[0].group, [0, 0.9, 0], [1.35, 1.65, 0.7], skin);
	addCapsule(layers[0].group, [0, -1.35, 0], 0.78, 1.5, skin);

	const fingers = [-0.9, -0.3, 0.3, 0.9];
	fingers.forEach((x, index) => {
		addCapsule(layers[0].group, [x, 2.55 + (index === 1 || index === 2 ? 0.2 : 0), 0], 0.28, 2.1, skin);
	});
	addCapsule(layers[0].group, [-1.35, 1.15, 0], 0.3, 1.25, skin, [0, 0, 0.82]);
}

function createMuscles() {
	const muscle = material('#a94739', 0.64);
	addSphere(layers[1].group, [0, 0.85, 0], [1.15, 1.4, 0.52], muscle);
	addCapsule(layers[1].group, [0, -1.25, 0], 0.56, 1.55, muscle);
	[-0.9, -0.3, 0.3, 0.9].forEach((x, index) => {
		addCapsule(layers[1].group, [x, 2.45 + (index === 1 || index === 2 ? 0.2 : 0), 0], 0.13, 1.75, muscle);
	});
	addSphere(layers[1].group, [-0.98, 1.3, 0], [0.34, 0.7, 0.28], muscle);
}

function createLigaments() {
	const ligament = material('#d5aa4d', 0.48, 0.05);
	[-0.9, -0.3, 0.3, 0.9].forEach((x, index) => {
		addBone(layers[2].group, [0, 1.85, 0], [x, 2.05 + (index === 1 || index === 2 ? 0.15 : 0), 0], 0.055, ligament);
		addBone(layers[2].group, [x, 1.95, 0], [x, 3.38 + (index === 1 || index === 2 ? 0.2 : 0), 0], 0.04, ligament);
	});
	addBone(layers[2].group, [-0.95, 1.65, 0], [-1.55, 1.05, 0], 0.06, ligament);
	addBone(layers[2].group, [-1.05, 1.55, 0.05], [1.05, 1.55, 0.05], 0.045, ligament);
	addBone(layers[2].group, [-1.15, 1.05, 0.05], [1.15, 1.05, 0.05], 0.04, ligament);
}

function createBones() {
	const bone = material('#eee7d8', 0.42);
	addBone(layers[3].group, [0, -1.95, 0], [0, 0.45, 0], 0.38, bone);
	addSphere(layers[3].group, [0, 0.6, 0], [1.05, 0.55, 0.5], bone);
	const fingers = [-0.9, -0.3, 0.3, 0.9];
	fingers.forEach((x, index) => {
		const tip = 3.8 + (index === 1 || index === 2 ? 0.2 : 0);
		addBone(layers[3].group, [0, 0.45, 0], [x * 0.7, 1.45, 0], 0.16, bone);
		addBone(layers[3].group, [x * 0.7, 0.7, 0], [x, 1.8, 0], 0.13, bone);
		addBone(layers[3].group, [x, 1.85, 0], [x, 2.75, 0], 0.11, bone);
		addBone(layers[3].group, [x, 2.8, 0], [x, tip, 0], 0.09, bone);
		addSphere(layers[3].group, [x, 1.8, 0], [0.19, 0.16, 0.16], bone);
		addSphere(layers[3].group, [x, 2.78, 0], [0.16, 0.14, 0.14], bone);
	});
	addBone(layers[3].group, [-0.7, 0.8, 0], [-1.42, 1.38, 0], 0.14, bone);
	addBone(layers[3].group, [-1.42, 1.38, 0], [-1.62, 2.12, 0], 0.11, bone);
}

function createVeins() {
	const vein = material('#4777a8', 0.42, 0.05);
	addTube(layers[4].group, [[0, -1.95, 0], [0.2, -0.8, 0.1], [-0.15, 0.4, 0.12], [0, 1.8, 0.1], [0.3, 2.9, 0.1], [0.3, 3.8, 0.1]], 0.045, vein);
	addTube(layers[4].group, [[0, 0.3, 0.1], [-0.7, 0.9, 0.1], [-0.9, 1.9, 0.1], [-0.9, 3.7, 0.1]], 0.038, vein);
	addTube(layers[4].group, [[0, 0.8, 0.1], [0.65, 1.3, 0.1], [0.9, 2.4, 0.1], [0.9, 3.8, 0.1]], 0.038, vein);
	addTube(layers[4].group, [[-0.25, 0.65, 0.1], [-1.05, 1.2, 0.1], [-1.55, 1.85, 0.1]], 0.04, vein);
	addTube(layers[4].group, [[0, 1.25, 0.12], [-0.55, 1.75, 0.12], [-0.3, 2.45, 0.12], [-0.3, 3.7, 0.12]], 0.028, vein);
	addTube(layers[4].group, [[0, 1.55, 0.12], [0.55, 1.95, 0.12], [0.3, 2.65, 0.12], [0.3, 3.75, 0.12]], 0.028, vein);
}

function createTendons() {
	const tendon = material('#d8c8a8', 0.38);
	[-0.9, -0.3, 0.3, 0.9].forEach((x, index) => {
		const tip = 3.8 + (index === 1 || index === 2 ? 0.2 : 0);
		addTube(layers[5].group, [[x * 0.7, -1.55, 0.12], [x * 0.55, 0.4, 0.12], [x, 1.65, 0.12], [x, tip, 0.12]], 0.07, tendon);
	});
	addTube(layers[5].group, [[-0.55, -1.55, 0.14], [-1.05, 0.2, 0.14], [-1.45, 1.1, 0.14], [-1.75, 2.1, 0.14]], 0.075, tendon);
}

function createNerves() {
	const nerve = material('#e2c95e', 0.34);
	addTube(layers[6].group, [[0.2, -1.95, 0.22], [0.35, -0.6, 0.22], [0.1, 0.55, 0.22], [-0.1, 1.75, 0.22]], 0.055, nerve);
	[-0.9, -0.3, 0.3, 0.9].forEach((x, index) => {
		const tip = 3.75 + (index === 1 || index === 2 ? 0.2 : 0);
		addTube(layers[6].group, [[-0.1, 1.65, 0.22], [x * 0.4, 2.05, 0.22], [x, 2.7, 0.22], [x, tip, 0.22]], 0.032, nerve);
	});
	addTube(layers[6].group, [[0.1, 0.25, 0.22], [-0.9, 0.9, 0.22], [-1.5, 1.85, 0.22]], 0.04, nerve);
}

function createArteries() {
	const artery = material('#bd413e', 0.3, 0.04);
	addTube(layers[7].group, [[0, -1.95, 0.28], [-0.2, -0.65, 0.28], [0.1, 0.5, 0.28], [0, 1.55, 0.28]], 0.065, artery);
	addTube(layers[7].group, [[0, 1.4, 0.28], [-0.55, 1.95, 0.28], [-0.6, 2.85, 0.28], [-0.6, 3.75, 0.28]], 0.04, artery);
	addTube(layers[7].group, [[0, 1.4, 0.28], [0.55, 2.0, 0.28], [0.6, 2.85, 0.28], [0.6, 3.75, 0.28]], 0.04, artery);
	addTube(layers[7].group, [[-0.1, 0.8, 0.28], [-0.95, 1.15, 0.28], [-1.55, 1.85, 0.28]], 0.038, artery);
}

function createFascia() {
	const fascia = material('#b9a9d0', 0.82, 0);
	fascia.transparent = true;
	fascia.opacity = 0.28;
	fascia.depthWrite = false;
	addSphere(layers[8].group, [0, 0.85, -0.2], [1.08, 1.36, 0.045], fascia);
	addCapsule(layers[8].group, [0, -1.25, -0.2], 0.56, 1.5, fascia);
}

createSkin();
createMuscles();
createLigaments();
createBones();
createVeins();
createTendons();
createNerves();
createArteries();
createFascia();

let reveal = Number(revealSlider.value);

function updateExplosion(value) {
	reveal = value;
	layers.forEach(({ group }, index) => {
		if (index === 0) {
			return;
		}

		const rearIndex = index - 1;
		group.position.x = rearIndex * 0.62 * reveal;
		group.position.y = rearIndex * 0.08 * reveal;
		group.position.z = -0.3 - rearIndex * 0.58 * reveal;
	});
}

function resize() {
	const bounds = viewer.getBoundingClientRect();
	renderer.setSize(bounds.width, bounds.height, false);
	camera.aspect = bounds.width / bounds.height;
	camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();
updateExplosion(reveal);

revealSlider.addEventListener('input', (event) => {
	updateExplosion(Number(event.currentTarget.value));
});

function animate() {
	controls.update();
	renderer.render(scene, camera);
	window.requestAnimationFrame(animate);
}

animate();
