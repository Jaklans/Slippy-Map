import {
	BoxGeometry,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Vector2,
	WebGLRenderer,
	Frustum,
	Camera,
	Renderer
} from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let camera:OrthographicCamera, scene:Scene, renderer:WebGLRenderer, controls:OrbitControls;

class App {

	init() {
		// Renderer
		renderer = new WebGLRenderer( { antialias: true } );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.setClearColor("#233143");
		renderer.setClearColor("#239943");
		document.body.appendChild( renderer.domElement );
		window.addEventListener( 'resize', onWindowResize, false );

		// Camera
		//camera = new PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
		camera = new OrthographicCamera(-1,1,-1,1,.1,10);
		camera.position.z = 4;
		controls = new OrbitControls( camera, renderer.domElement );
		// Slightly less than 180 deg viewing angle
		controls.maxAzimuthAngle = 1;
		controls.maxPolarAngle = 1;
		controls.enableRotate = false;

		let allowedRotationAngle = Math.PI / 6;
		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		controls.minPolarAngle = allowedRotationAngle; // radians
		controls.maxPolarAngle = Math.PI - allowedRotationAngle; // radians

		// How far you can orbit horizontally, upper and lower limits.
		// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
		controls.minAzimuthAngle = 0;//-Math.PI + allowedRotationAngle; // radians
		controls.maxAzimuthAngle = 0;// Math.PI - allowedRotationAngle; // radians

		// Base scene
		scene = new Scene();
		const geometry = new PlaneGeometry();
		const material = new MeshBasicMaterial();

		// Base geometry
		const mesh = new Mesh( geometry, material );
		mesh.rotateX(Math.PI)
		scene.add( mesh );

		animate();
	}
}

function onWindowResize() {

	//camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {

	requestAnimationFrame( animate );

	update();

	renderer.render( scene, camera );
}

function update()
{
	let frustum = new Frustum();
	let cameraProjMat = camera.projectionMatrix;
	frustum.setFromProjectionMatrix(cameraProjMat);

}

class QuadTree
{
	// Position of center of tree
	position : Vector2;
	// Width and height of the tree at top level
	// Changing this would require rebuilding the tree
	size : Vector2;
	get halfSize() { return this.size.divideScalar(2); }
	root : QuadTreeNode;

	constructor(position : Vector2, size : Vector2){
		this.position = position;
		this.size = size;

		this.root = new QuadTreeNode(this, 0, position);
	}

	GetSizeAtLevel(level:number){
		return this.size.divideScalar(2^(level+1));
	}

	GetHalfSizeAtLevel(level:number){
		return this.size.divideScalar(2^(level+2));
	}
}

class QuadTreeNode
{
	context : QuadTree;
	level : number;
	center : Vector2;
	active : boolean;
	children : Array<QuadTreeNode | null>;

	constructor(context:QuadTree, level:number, center:Vector2){
		this.context = context;
		this.level = level;
		this.center = center;
		this.active = false;

		this.children = new Array(4).fill(null);
	}
	
	GetChild(index:number) {
		if (!this.children[index]){
			let childSize = this.context.GetSizeAtLevel(this.level+1);
			let childPositionOffset = childSize;

			// Quadrant indexes are as follows:
			//  ---------
			//  | 0 | 1 |
			//  ---------
			//  | 2 | 3 |
			//  ---------

			// Create a factor for the position offset to direct it
			// to the correct quadrant
			let direction = 
				new Vector2(
					index==0 || index==2 ? -1 : 1, 
					index==0 || index==1 ? -1 : 1);
			
			// center + (offset * direction)
			let childCenter = this.center.add(childPositionOffset.multiply(direction));

			this.children[index] = new QuadTreeNode(this.context, this.level + 1, childCenter);
		}

		return this.children[index];
	}
}


/* Proposed rules:
	-Start at top level
		-Add to render stack
		-Check if exactly one of children's center is in frustrum
			-If true,
				-Recurse on children
			-Else,
				-Add children to render stack, then return
*/

export default App;

const app = new App();
app.init();