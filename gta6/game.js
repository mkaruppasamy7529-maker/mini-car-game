// GTA 6 Web Edition - Realistic Engine V4
const canvas = document.getElementById('gameCanvas');
const setupScreen = document.getElementById('setup-screen');
const gameContainer = document.getElementById('game-container');
const backBtn = document.getElementById('back-btn');
const speedUI = document.getElementById('speed');
const driftIndicator = document.getElementById('drift-indicator');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const timeDisplay = document.getElementById('time-display');
const mobileControls = document.getElementById('mobile-controls');
const carSelect = document.getElementById('car-select');

let isRunning = false;
let animationFrame;
let inputMode = 'pc'; // 'pc' or 'mobile'

// --- DEVICE SETUP ---
document.getElementById('btn-pc').addEventListener('click', () => startGame('pc'));
document.getElementById('btn-mobile').addEventListener('click', () => startGame('mobile'));

function startGame(mode) {
    inputMode = mode;
    setupScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    if(mode === 'mobile') {
        mobileControls.classList.remove('hidden');
         // Add class to body to adjust HUD positions for mobile
        document.body.classList.add('hud-mobile');
    }
    
    // Reset pos
    carGroup.position.set(0, 10, 0); // Drop in
    carVel.set(0,0,0);
    
    isRunning = true;
    animate();
}

backBtn.addEventListener('click', () => {
    setupScreen.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    mobileControls.classList.add('hidden');
    document.body.classList.remove('hud-mobile');
    isRunning = false;
    cancelAnimationFrame(animationFrame);
});


// --- 3D ENGINE & CLIMATE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Realistic blue sky
scene.fog = new THREE.FogExp2(0x87CEEB, 0.0015);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 3000);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;

// Lighting (Dynamic Sun)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffee, 1.2);
sunLight.position.set(500, 1000, 500);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -500;
sunLight.shadow.camera.right = 500;
sunLight.shadow.camera.top = 500;
sunLight.shadow.camera.bottom = -500;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 3000;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

// Build Sun Mesh
const sunGeo = new THREE.SphereGeometry(50, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);


// --- ENVIRONMENT GENERATION ---

// Materials
const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.1 });
const cementMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9, metalness: 0.1 });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x3b5323, roughness: 1.0 });

// Map Config
const mapSize = 2500;

// Ground Plane (Grass/Dirt base)
const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize);
const ground = new THREE.Mesh(groundGeo, grassMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Collidables Array for Raycasting
const collidables = [];
collidables.push(ground);

// Sidewalks & Roads
const cityBlockSize = 80;
const roadWidth = 20;

// Giant procedural map
const buildables = []; // to hold standard buildings for minimap

// 1. Generate grid blocks
for(let x = -600; x <= 600; x += cityBlockSize) {
    for(let z = -600; z <= 600; z += cityBlockSize) {
        
        // Define block
        const blockW = cityBlockSize - roadWidth;
        const blockD = cityBlockSize - roadWidth;
        
        // Concrete block base
        const blockGeo = new THREE.BoxGeometry(blockW, 0.4, blockD);
        const block = new THREE.Mesh(blockGeo, cementMat);
        block.position.set(x, 0.2, z);
        block.receiveShadow = true;
        scene.add(block);
        collidables.push(block);

        // Keep center open
        if(Math.abs(x) < 80 && Math.abs(z) < 80) continue;

        // Determine what goes on the block
        let rand = Math.random();
        
        if (rand > 0.95) {
            // MULTI-LEVEL PARKING GARAGE
             const floors = 4;
             for(let f=0; f<floors; f++) {
                 let yPos = 0.4 + (f * 6);
                 
                 // Floor slab
                 const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(blockW-2, 0.5, blockD-2), cementMat);
                 floorMesh.position.set(x, yPos, z);
                 floorMesh.castShadow = true; floorMesh.receiveShadow = true;
                 scene.add(floorMesh);
                 collidables.push(floorMesh);
                 
                 // Ramp up to next floor (except top)
                 if(f < floors - 1) {
                     const rampObj = new THREE.Mesh(new THREE.BoxGeometry(8, 6.2, blockD-10), cementMat);
                     // Position on edge, slope it
                     rampObj.position.set(x - blockW/2 + 6, yPos + 3, z);
                     rampObj.rotation.z = Math.PI / -8; // Slope up
                     rampObj.castShadow = true; rampObj.receiveShadow = true;
                     scene.add(rampObj);
                     collidables.push(rampObj);
                 }
                 
                 // Pillars
                 const pillarGeo = new THREE.BoxGeometry(1, 6, 1);
                 const p1 = new THREE.Mesh(pillarGeo, cementMat); p1.position.set(x-blockW/2+2, yPos+3, z-blockD/2+2);
                 const p2 = new THREE.Mesh(pillarGeo, cementMat); p2.position.set(x+blockW/2-2, yPos+3, z-blockD/2+2);
                 const p3 = new THREE.Mesh(pillarGeo, cementMat); p3.position.set(x+blockW/2-2, yPos+3, z+blockD/2-2);
                 const p4 = new THREE.Mesh(pillarGeo, cementMat); p4.position.set(x-blockW/2+2, yPos+3, z+blockD/2-2);
                 scene.add(p1,p2,p3,p4);
                 collidables.push(p1,p2,p3,p4);
             }
             
             buildables.push({minX: x-blockW/2, maxX: x+blockW/2, minZ: z-blockD/2, maxZ: z+blockD/2, color: 0x555555});

        } else if (rand > 0.3) {
            // STANDARD SKYSCRAPER
            const bWidth = blockW - 4 - Math.random()*10;
            const bDepth = blockD - 4 - Math.random()*10;
            const bHeight = 30 + Math.random() * 200;
            
            const bColor = new THREE.Color().setHSL(Math.random(), 0.3 + Math.random()*0.5, 0.2 + Math.random()*0.6);
            
            // Physical glass material for realistic reflections
            const bMat = new THREE.MeshPhysicalMaterial({ 
                color: bColor, metalness: 0.3, roughness: 0.1, 
                clearcoat: 0.8, clearcoatRoughness: 0.2 
            });
            
            const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bWidth, bHeight, bDepth), bMat);
            bMesh.position.set(x, 0.4 + bHeight/2, z);
            bMesh.castShadow = true; bMesh.receiveShadow = true;
            scene.add(bMesh);
            collidables.push(bMesh);
            
            buildables.push({minX: x-bWidth/2, maxX: x+bWidth/2, minZ: z-bDepth/2, maxZ: z+bDepth/2, color: bColor.getHex()});
        }
    }
}

// Draw the master road mesh
const roadNetGeo = new THREE.PlaneGeometry(1200, 1200);
const roadNet = new THREE.Mesh(roadNetGeo, asphaltMat);
roadNet.rotation.x = -Math.PI / 2;
roadNet.position.y = 0.05; // slightly above grass
scene.add(roadNet);
// roadNet does not need to be in collidables if grass is there, but for smoothness let's add it
collidables.push(roadNet);

// Mountains (Borders)
function createMountainDist(x, z, w, d) {
    const geo = new THREE.ConeGeometry(w/2, 200 + Math.random()*300, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d4a3e, roughness: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 100, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    collidables.push(mesh);
}
// Surround map
for(let m=-800; m<=800; m+= 300) {
    createMountainDist(m, -800, 400, 400); // North edge
    createMountainDist(m, 800, 400, 400);  // South edge
    createMountainDist(-800, m, 400, 400); // West edge
    createMountainDist(800, m, 400, 400);  // East edge
}

// Birds (Particles)
const birdGeo = new THREE.ConeGeometry(0.5, 1.5, 3);
birdGeo.rotateX(Math.PI/2);
const birdMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const birds = [];
for(let b=0; b<30; b++) {
    const bird = new THREE.Mesh(birdGeo, birdMat);
    bird.position.set( (Math.random()-0.5)*1000, 150 + Math.random()*100, (Math.random()-0.5)*1000 );
    bird.userData = { speed: 1 + Math.random(), offset: Math.random()*100 };
    scene.add(bird);
    birds.push(bird);
}

// --- VEHICLES ---

const carGroup = new THREE.Group();
scene.add(carGroup);

const carPaint = new THREE.MeshPhysicalMaterial({ 
    color: 0xffaa00, // Lamborghini Orange
    metalness: 0.6, roughness: 0.1, 
    clearcoat: 1.0, clearcoatRoughness: 0.1 
});
const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
const glassPaint = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0.9, roughness: 0.05 });
const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

let wheels = [];
let meshesLambo = new THREE.Group();
let meshesTruck = new THREE.Group();
let meshesSedan = new THREE.Group();

// --- Build Lamborghini Model ---
// Wedge nose
const lNoseGeo = new THREE.BoxGeometry(1.8, 0.4, 1.5);
const lNose = new THREE.Mesh(lNoseGeo, carPaint);
lNose.position.set(0, 0.4, -1.8);
lNose.rotation.x = Math.PI / 8; // sloped down
meshesLambo.add(lNose);

// Middle body
const lBody = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 2.5), carPaint);
lBody.position.set(0, 0.5, 0);
meshesLambo.add(lBody);

// Rear body
const lRear = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 1.5), carPaint);
lRear.position.set(0, 0.55, 1.8);
meshesLambo.add(lRear);

// Cabin wedge
const lCabinGeo = new THREE.BoxGeometry(1.6, 0.5, 1.8);
const lCabin = new THREE.Mesh(lCabinGeo, glassPaint);
lCabin.position.set(0, 0.9, 0.2);
lCabin.rotation.x = -Math.PI / 16;
meshesLambo.add(lCabin);

// Spoiler
const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.4), darkPlastic);
spoiler.position.set(0, 0.95, 2.3);
meshesLambo.add(spoiler);
const sLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), darkPlastic); sLeg1.position.set(-0.6, 0.8, 2.3);
const sLeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), darkPlastic); sLeg2.position.set(0.6, 0.8, 2.3);
meshesLambo.add(sLeg1, sLeg2);

// Taillights
const lTail1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), brakeLightMat); lTail1.position.set(-0.6, 0.6, 2.55);
const lTail2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), brakeLightMat); lTail2.position.set(0.6, 0.6, 2.55);
meshesLambo.add(lTail1, lTail2);

// Enable shadows
meshesLambo.traverse(child => { if(child.isMesh) { child.castShadow = true; child.receiveShadow = true; }});
carGroup.add(meshesLambo);

// Build Generic Truck (hidden by default)
const tBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 5), new THREE.MeshPhysicalMaterial({color: 0x2233ff}));
tBody.position.set(0, 1.2, 0);
tBody.castShadow = true;
meshesTruck.add(tBody);
const tTail1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.1), brakeLightMat); tTail1.position.set(-0.8, 1.2, 2.55);
const tTail2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.1), brakeLightMat); tTail2.position.set(0.8, 1.2, 2.55);
meshesTruck.add(tTail1, tTail2);
meshesTruck.visible = false;
carGroup.add(meshesTruck);

// Build Generic Sedan
const sBody = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshPhysicalMaterial({color: 0x999999}));
sBody.position.set(0, 0.8, 0);
sBody.castShadow = true;
meshesSedan.add(sBody);
const sCabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2), glassPaint);
sCabin.position.set(0, 1.4, 0);
meshesSedan.add(sCabin);
const sTail1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), brakeLightMat); sTail1.position.set(-0.6, 0.8, 2.05);
const sTail2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), brakeLightMat); sTail2.position.set(0.6, 0.8, 2.05);
meshesSedan.add(sTail1, sTail2);
meshesSedan.visible = false;
carGroup.add(meshesSedan);

// Wheels attached to carGroup (shared)
const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 24);
wheelGeo.rotateZ(Math.PI/2);
const wFL = new THREE.Mesh(wheelGeo, darkPlastic); wFL.position.set(-1.1, 0.4, -1.6);
const wFR = new THREE.Mesh(wheelGeo, darkPlastic); wFR.position.set(1.1, 0.4, -1.6);
const wBL = new THREE.Mesh(wheelGeo, darkPlastic); wBL.position.set(-1.1, 0.4, 1.6);
const wBR = new THREE.Mesh(wheelGeo, darkPlastic); wBR.position.set(1.1, 0.4, 1.6);
carGroup.add(wFL, wFR, wBL, wBR);
wheels = [wFL, wFR, wBL, wBR];


// UI Vehicle Selector Event
carSelect.addEventListener('change', (e) => {
    meshesLambo.visible = false;
    meshesTruck.visible = false;
    meshesSedan.visible = false;
    
    if(e.target.value === 'lambo') meshesLambo.visible = true;
    if(e.target.value === 'truck') meshesTruck.visible = true;
    if(e.target.value === 'sedan') meshesSedan.visible = true;
});


// --- REALISTIC PHYSICS & RAYCASTING ---

// Variables for 3D state
let carVel = new THREE.Vector3();
let carAngle = 0; // steering rotation
let verticalVelocity = 0;
let isGrounded = false;
const gravity = -0.015;

const carProps = {
    accel: 0.04, brake: 0.08, friction: 0.02,
    maxSpeed: 2.0, turnSpeed: 0.05,
    grip: 0.94, driftGrip: 0.985
};

const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Touch UI Listeners
const steerDot = document.getElementById('steerDot');
const steerZone = document.getElementById('steer-zone');
let uiSteer = 0;
let isSteering = false;
steerZone.addEventListener('touchstart', e => { isSteering = true; handleSteer(e.touches[0]); });
steerZone.addEventListener('touchmove', e => { if(isSteering) handleSteer(e.touches[0]); e.preventDefault(); }, {passive: false});
steerZone.addEventListener('touchend', e => { isSteering = false; uiSteer = 0; steerDot.style.transform = `translate(-50%, -50%)`; });

function handleSteer(touch) {
    const rect = steerZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let dx = touch.clientX - centerX;
    let max = rect.width / 2;
    if(dx > max) dx = max; if(dx < -max) dx = -max;
    steerDot.style.transform = `translate(calc(-50% + ${dx}px), -50%)`;
    uiSteer = -(dx / max);
}

document.getElementById('mGas').addEventListener('touchstart', (e) => { keys['w']=true; e.preventDefault(); });
document.getElementById('mGas').addEventListener('touchend', (e) => { keys['w']=false; e.preventDefault(); });
document.getElementById('mBrake').addEventListener('touchstart', (e) => { keys['s']=true; e.preventDefault(); });
document.getElementById('mBrake').addEventListener('touchend', (e) => { keys['s']=false; e.preventDefault(); });
document.getElementById('mDrift').addEventListener('touchstart', (e) => { keys[' ']=true; e.preventDefault(); });
document.getElementById('mDrift').addEventListener('touchend', (e) => { keys[' ']=false; e.preventDefault(); });

const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

function getSurfaceY(x, y, z) {
    raycaster.set(new THREE.Vector3(x, y + 20, z), downVector);
    const intersects = raycaster.intersectObjects(collidables);
    if(intersects.length > 0) {
        return intersects[0].point.y;
    }
    return 0; // Default floor
}

// Bounding box checking for walls (horizontal collision)
const boxPadding = 1.0;
function checkHorizontalCollision(nextX, y, nextZ) {
    // Only check buildings if we are driving near the ground/roof
    for(let i=0; i<collidables.length; i++) {
        const obj = collidables[i];
        if(!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        const bbox = obj.geometry.boundingBox.clone();
        bbox.applyMatrix4(obj.matrixWorld);
        
        // If it's a ramp, skip horizontal block logic
        if(Math.abs(obj.rotation.z) > 0.01 || Math.abs(obj.rotation.x) > 0.01) continue; 
        
        // If it's grass or road, skip
        if(bbox.max.y < 0.5) continue;
        
        // Check if car intersects horizontally
        if(nextX + boxPadding > bbox.min.x && nextX - boxPadding < bbox.max.x &&
           nextZ + boxPadding > bbox.min.z && nextZ - boxPadding < bbox.max.z) {
            
            // Check vertically (can pass under or over?)
            if(y < bbox.max.y && y + 2 > bbox.min.y) {
                 return true;
            }
        }
    }
    return false;
}

// --- GAME LOOP ---
function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

// Advanced Camera System
let camOffset = new THREE.Vector3(0, 4, 12);
let currentCamPos = new THREE.Vector3();

// Time of day logic
let timeOfDay = 8; // 8 AM

function updateMinimap() {
    minimapCtx.clearRect(0,0,160,160);
    minimapCtx.save();
    minimapCtx.translate(80, 80);
    minimapCtx.scale(0.3, 0.3);
    minimapCtx.translate(-carGroup.position.x, -carGroup.position.z);
    
    // Draw buildables
    buildables.forEach(b => {
        minimapCtx.fillStyle = '#' + b.color.toString(16).padStart(6, '0');
        minimapCtx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
    });
    
    minimapCtx.restore();
    
    // Draw player in center
    minimapCtx.fillStyle = '#fff';
    minimapCtx.beginPath(); minimapCtx.arc(80, 80, 4, 0, Math.PI*2); minimapCtx.fill();
    // direction wedge
    minimapCtx.fillStyle = '#0f85d2';
    minimapCtx.beginPath();
    minimapCtx.moveTo(80, 75); minimapCtx.lineTo(76, 82); minimapCtx.lineTo(84, 82); minimapCtx.fill();
}

function animate() {
    if(!isRunning) return;
    animationFrame = requestAnimationFrame(animate);

    // Inputs
    let kGas = keys['w'] || keys['arrowup'] ? 1 : (keys['s'] || keys['arrowdown'] ? -1 : 0);
    let kSteer = 0;
    if(keys['a'] || keys['arrowleft']) kSteer = 1;
    if(keys['d'] || keys['arrowright']) kSteer = -1;
    if(inputMode === 'mobile' && uiSteer !== 0) kSteer = uiSteer;
    let kDrift = keys[' '];

    // Throttle application (forward vector)
    let forwardVec = new THREE.Vector3(0,0,-1);
    forwardVec.applyAxisAngle(new THREE.Vector3(0,1,0), carAngle);
    
    if(kGas === 1) carVel.add(forwardVec.clone().multiplyScalar(carProps.accel));
    else if(kGas === -1) carVel.sub(forwardVec.clone().multiplyScalar(carProps.brake));

    // Friction
    carVel.x *= (1 - carProps.friction);
    carVel.z *= (1 - carProps.friction);

    // Limit speed horizontally
    let horizSpeed = Math.sqrt(carVel.x*carVel.x + carVel.z*carVel.z);
    if(horizSpeed > carProps.maxSpeed) {
        let mult = carProps.maxSpeed / horizSpeed;
        carVel.x *= mult; carVel.z *= mult;
    }
    if(horizSpeed < 0.01 && kGas === 0) { carVel.x = 0; carVel.z = 0; }

    // Steering
    let rightVec = new THREE.Vector3(forwardVec.z, 0, -forwardVec.x);
    let forwardSpeed = carVel.clone().dot(forwardVec);
    let rightSpeed = carVel.clone().dot(rightVec);
    
    if(Math.abs(forwardSpeed) > 0.05) {
        let turnDir = forwardSpeed > 0 ? 1 : -1;
        carAngle += kSteer * carProps.turnSpeed * turnDir;
    }

    // Grip logic
    let grip = kDrift ? carProps.driftGrip : carProps.grip;
    rightSpeed *= grip; // Side slip
    
    // Reconstruct velocity
    carVel.x = forwardVec.x * forwardSpeed + rightVec.x * rightSpeed;
    carVel.z = forwardVec.z * forwardSpeed + rightVec.z * rightSpeed;

    // --- HORIZONTAL COLLISION ---
    let nextX = carGroup.position.x + carVel.x;
    let nextZ = carGroup.position.z + carVel.z;
    
    if(checkHorizontalCollision(nextX, carGroup.position.y, carGroup.position.z)) {
        carVel.x *= -0.4; nextX = carGroup.position.x;
    }
    if(checkHorizontalCollision(carGroup.position.x, carGroup.position.y, nextZ)) {
        carVel.z *= -0.4; nextZ = carGroup.position.z;
    }

    // --- VERTICAL RAYCASTING (Gravity & Ramps) ---
    verticalVelocity += gravity; // Apply heavy gravity natively
    let nextY = carGroup.position.y + verticalVelocity;
    
    // Find expected ground height at next horizontal pos
    let surfaceY = getSurfaceY(nextX, nextY, nextZ);

    if (nextY <= surfaceY) {
        // We hit the ground/ramp! Stick to it.
        nextY = surfaceY;
        verticalVelocity = 0;
        isGrounded = true;
    } else {
        isGrounded = false;
    }

    // Apply all translations
    carGroup.position.set(nextX, nextY, nextZ);
    carGroup.rotation.y = carAngle;

    // --- PITCH CALCULATION FOR RAMPS ---
    // Shoot an extra ray ahead to angle the car body
    let aheadTargetY = getSurfaceY(nextX + forwardVec.x*2, nextY, nextZ + forwardVec.z*2);
    let pitchDiff = aheadTargetY - nextY;
    let targetPitch = Math.atan2(pitchDiff, 2);
    carGroup.rotation.x = THREE.MathUtils.lerp(carGroup.rotation.x, -targetPitch, 0.2);


    // --- ANIMATIONS & FX ---
    // Wheel animation
    let wRot = horizSpeed * (forwardSpeed > 0 ? -1 : 1);
    wheels.forEach(w => w.rotation.x += wRot);
    wheels[0].rotation.z = -kSteer * 0.5;
    wheels[1].rotation.z = -kSteer * 0.5;

    // Brake lights
    const brakeColor = kGas === -1 ? 0xff0000 : 0x330000;
    lTail1.material.color.setHex(brakeColor); lTail2.material.color.setHex(brakeColor);
    tTail1.material.color.setHex(brakeColor); tTail2.material.color.setHex(brakeColor);
    sTail1.material.color.setHex(brakeColor); sTail2.material.color.setHex(brakeColor);

    // Drift UI
    if(kDrift && horizSpeed > 0.4) driftIndicator.classList.remove('hidden-el');
    else driftIndicator.classList.add('hidden-el');
    
    speedUI.innerText = Math.round(Math.abs(forwardSpeed) * 60);

    // Animate Birds
    birds.forEach(bird => {
        let fv = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), bird.rotation.y);
        bird.position.add(fv.multiplyScalar(bird.userData.speed));
        // simple flap flap
        bird.scale.y = 1 + Math.sin(Date.now()*0.01 + bird.userData.offset)*0.5;
        // respawn edge
        if(bird.position.x > 1500) { bird.position.x = -1500; bird.rotation.y = Math.random()*Math.PI*2; }
        if(bird.position.x < -1500) { bird.position.x = 1500; bird.rotation.y = Math.random()*Math.PI*2; }
        if(bird.position.z > 1500) { bird.position.z = -1500; bird.rotation.y = Math.random()*Math.PI*2; }
        if(bird.position.z < -1500) { bird.position.z = 1500; bird.rotation.y = Math.random()*Math.PI*2; }
    });

    // Time cycle / Sun movement
    timeOfDay += 0.005; // Fast time
    if(timeOfDay > 24) timeOfDay = 0;
    
    let timePercent = timeOfDay / 24;
    let sunAngle = (timePercent * Math.PI * 2) - Math.PI/2;
    sunLight.position.set(Math.cos(sunAngle)*1000, Math.sin(sunAngle)*1000, Math.cos(sunAngle)*500);
    sunMesh.position.copy(sunLight.position);

    // Change Sky color based on time
    if (timeOfDay > 6 && timeOfDay < 18) {
        scene.background.lerpColors(new THREE.Color(0xff6b4a), new THREE.Color(0x87CEEB), Math.min(1, (timeOfDay-6)/2));
        scene.fog.color.copy(scene.background);
        sunLight.intensity = 1.2;
    } else {
        scene.background.lerpColors(new THREE.Color(0x87CEEB), new THREE.Color(0x020111), Math.min(1, (timeOfDay > 18 ? timeOfDay-18 : timeOfDay)/2));
        scene.fog.color.copy(scene.background);
        sunLight.intensity = 0.1; // Night moon
    }
    
    let hours = Math.floor(timeOfDay);
    let mins = Math.floor((timeOfDay - hours) * 60);
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let dH = hours % 12 || 12;
    timeDisplay.innerText = `${dH.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')} ${ampm}`;

    // --- CAMERA FLUIDITY (Spring follow) ---
    // The camera wants to be offset *behind* the car
    let offset = camOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), carAngle);
    let targetCamPos = carGroup.position.clone().add(offset);
    
    // Give it a bouncy, realistic delay
    currentCamPos.lerp(targetCamPos, 0.1);
    // Keep it from clipping underground if looking up
    if(currentCamPos.y < surfaceY + 2) currentCamPos.y = surfaceY + 2;
    
    camera.position.copy(currentCamPos);
    
    let lookOffset = forwardVec.clone().multiplyScalar(10);
    lookOffset.y = 0; // look straight
    let lookTarget = carGroup.position.clone().add(lookOffset);
    camera.lookAt(lookTarget);

    updateMinimap();
    renderer.render(scene, camera);
}
