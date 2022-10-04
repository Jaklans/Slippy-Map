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
	Renderer,
	Color,
	Vector3
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
		material.color = new Color("#114477");

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
	//controls.addEventListener("Change", () => Map.Update());
}

class Map
{
	tree : QuadTree;
	activeNodeStack : Array<QuadTreeNode>;

	constructor(){
		this.tree = new QuadTree(new Vector2(0,0), new Vector2(0,0));
		this.activeNodeStack = new Array<QuadTreeNode>();
	}

	Update(frustum:Frustum, scene:Scene){
		let index = 0;
		let node = this.tree.root;
		while(true){
			
		}
	}

	// Helper to try to add to the stack at given index
	// Checks current value at that index, and does nothing
	// if it is the same as the proposed append. Otherwise,
	// clears any existing values after index and appends
	private AppendToStack(node:QuadTreeNode, index:number){
		if (this.activeNodeStack.length - 1 >= index){
				if (this.activeNodeStack[index] != node){
				// Remove all nodes after this (stack is modified, returns ones that were removed)
				let removedNodes = this.activeNodeStack.splice(index, this.activeNodeStack.length - 1 - index);
				// todo, purge these nodes from scene
			}
		}
		else {
			this.activeNodeStack.push(node);
		}
	}
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

	GetNodeList(frustum:Frustum){
		let nodes = new Array<QuadTreeNode>();
		let activeNode = this.root;
		nodes.push(this.root);

		while(true){
			let childrenInFrustum = activeNode.GetChildrenInFrustum(frustum);
			if (childrenInFrustum.length == 0){
				break;
			}
			else if (childrenInFrustum.length > 1) {
				nodes.push.apply(nodes, childrenInFrustum);
				break;
			}
			else if (childrenInFrustum.length == 1){
				nodes.push(childrenInFrustum[0]);
				activeNode = childrenInFrustum[0];
			}
		}

		return nodes;
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
	
	GetChild(index:number) : QuadTreeNode {
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

		return this.children[index] as QuadTreeNode;
	}

	GetChildrenInFrustum(frustum:Frustum){
		let children = new Array<QuadTreeNode>();
		for (let index = 0; index < 4; index++) {
			let node = this.GetChild(index);

			// TODO: The Vector2 vs Vector3 is a bit messy, should be refactored
			if ( frustum.containsPoint(new Vector3(node.center.x, node.center.y, 0))){
				children.push(node);
			}
		}
		return children;
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

	-Rational behind the stack
		-On most camera movements, the path through the graph will be similar until the end
			-We can avoid sections of rebuilding scene graph
		-If we were actually loading images, keeping the lower LOD images rendering would be 
		 helpful while the lower levels are being streamed in
		-Immediately moving large distances will always have *something* on screen, even if 
		 very low res
			
*/

export default App;

const app = new App();
app.init();