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
	Vector3,
	Raycaster
} from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Should be moved to the app class
let camera:OrthographicCamera, scene:Scene, renderer:WebGLRenderer, controls:OrbitControls, map:Map;

class App {

	init() {
		// Renderer
		renderer = new WebGLRenderer( { antialias: true } );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.setClearColor("#233143");
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

		scene = new Scene();

		map = new Map(scene);

		controls.addEventListener("change", () => map.Update(camera));

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
}

class Map
{
	tree : QuadTree;
	activeNodeStack : Array<QuadTreeNode>;
	scene:Scene;


	constructor(scene:Scene){
		this.tree = new QuadTree(new Vector2(0,0), new Vector2(10,10));
		this.activeNodeStack = new Array<QuadTreeNode>();
		this.scene = scene;
		this.tree.root.SetToRender(true, this.scene);
	}

	Update(camera:Camera){
		let frustum = new Frustum().setFromProjectionMatrix(camera.projectionMatrix);

		// Get all nodes that must be rendered with given frustum
		let requiredNodes = this.tree.GetNodeList(frustum);

		let expiredNodes = this.activeNodeStack.filter(x => !requiredNodes.includes(x));
		
		expiredNodes.forEach(node => {
			node.SetToRender(false, this.scene);
		});

		requiredNodes.forEach(node => {
			node.SetToRender(false, this.scene);
		});

		this.activeNodeStack = requiredNodes;
	}

	/* I considered refactoring this to calculate the frustum edges and find the 
	   intersection of those and the plane, but switched to generalized 3d frustum
	   checking. It was better prepared to handle changing requirements, and much 
	   easier/less janky to impliment

	private GetCameraBoundsOnMap(camera:Camera){
		let frustum = new Frustum().setFromProjectionMatrix(camera.projectionMatrix);

		const raycaster = new Raycaster();

		raycaster.setFromCamera(new Vector2(-1,-1), camera);
		const minHits = raycaster.intersectObject(this.tree.root.mesh as Mesh);
		raycaster.setFromCamera(new Vector2(1,1), camera);
		const maxHits = raycaster.intersectObject(this.tree.root.mesh as Mesh);


		if (minHits.length != 1 && maxHits.length != 1){
			return null;
		}

		if (minHits.length == 1){
			var min = new Vector2(minHits[0].point.x, minHits[0].point.y);
		}
		else{
			console.log()
			var min = this.tree.position.sub(this.tree.size.divideScalar(2));
		}

		if (maxHits.length == 1){
			var max = new Vector2(maxHits[0].point.x, maxHits[0].point.y);
		}
		else{
			var max = this.tree.position.add(this.tree.size.divideScalar(2));
		}

		console.log(min);

		console.log(max);

		return new rect(min, max);
	}*/
}

class QuadTree
{
	// Position of center of tree
	position : Vector2;
	// Width and height of the tree at top level
	// Changing this would require rebuilding the tree
	size : Vector2;
	root : QuadTreeNode;
	colorA : Color;
	colorB : Color;
	maxSubdivisions : number;
	minRatioToSubdivide : number;

	constructor(position : Vector2, size : Vector2){
		this.position = position;
		this.size = size;
		this.root = new QuadTreeNode(this, null, 0, position);

		this.colorA = new Color("#1f4260");
		this.colorB = new Color("#f3ff82");
		this.maxSubdivisions = 10;
		this.minRatioToSubdivide = .25;
	}

	GetSizeAtLevel(level:number){
		return this.size.divideScalar(2^(level+1));
	}

	GetHalfSizeAtLevel(level:number){
		return this.size.divideScalar(2^(level+2));
	}

	GetColorAtLevel(level:number){
		return this.colorA.lerp(this.colorB, level / this.maxSubdivisions);
	}

	GetNodeList(frustum:Frustum){
		
		let nodes = new Array<QuadTreeNode>();

		this.root.GetChildrenInRectRecursive(frustum, nodes);

		return nodes;
	}
}

class QuadTreeNode
{
	context : QuadTree;
	level : number;
	center : Vector2;
	bounds : rect;
	active : boolean;
	parent : QuadTreeNode | null;
	children : Array<QuadTreeNode | null>;

	// Rendering / SceneGraph
	mesh : Mesh | null;

	constructor(context:QuadTree, parent : QuadTreeNode | null, level:number, center:Vector2){
		this.context = context;
		this.parent = parent;
		this.level = level;
		this.center = center;
		this.active = false;
		this.mesh = null;

		let halfSize = center.add(this.context.GetSizeAtLevel(level).divideScalar(2));

		this.bounds = new rect(center.sub(halfSize), center.add(halfSize));
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

			this.children[index] = new QuadTreeNode(this.context, this, this.level + 1, childCenter);
		}

		return this.children[index] as QuadTreeNode;
	}
	
	

	GetChildrenInRectRecursive(frustum:Frustum, nodeOutput:Array<QuadTreeNode>){
		return;
		// Planes are, in order, {left, right, top, bottom, near, far}
		let distanceToLeft1 = frustum.planes[0].distanceToPoint(this.AsVec3(this.bounds.max));
		let distanceToLeft2 = frustum.planes[0].distanceToPoint(this.AsVec3(this.bounds.min));
		let distanceToRight1 = frustum.planes[1].distanceToPoint(this.AsVec3(this.bounds.max));

		// Checks to make sure that some of the rect is in the frustum
		if (distanceToLeft2 > 0 || distanceToRight1 > 0) {
			return;
		}

		// TODO: this may lead to unexpected behavior for tiles that border the frustum
		distanceToLeft1 = Math.abs(distanceToLeft1);
		distanceToLeft2 = Math.abs(distanceToLeft1);
		distanceToRight1 = Math.abs(distanceToLeft1);

		let frustumWidth = distanceToLeft1 + distanceToRight1;

		let horizontalRatio = (frustumWidth - distanceToLeft2 - distanceToRight1) / frustumWidth;

		if (horizontalRatio < this.context.minRatioToSubdivide){
			return;
		}

		nodeOutput.push(this);
		
		if (this.level >= this.context.maxSubdivisions){
			return;
		}

		for (let index = 0; index < 4; index++) {
			let node = this.GetChild(index);

			node.GetChildrenInRectRecursive(frustum, nodeOutput);
		}
	}

	SetToRender(render:boolean, scene : Scene){
		if (!this.mesh){
			if (render){
				const size = this.context.GetSizeAtLevel(this.level);
				const geometry = new PlaneGeometry(size.x, size.y);
				const material = new MeshBasicMaterial();
				material.color = this.context.GetColorAtLevel(this.level);
				this.mesh = new Mesh(geometry, material);
				this.mesh.parent = this.parent ? this.parent.mesh : null;
				this.mesh.position.set(this.center.x, this.center.y, 0);

				// Done to demonstrate that only required nodes are considered for rendering
				this.mesh.frustumCulled = false;

				// TODO: Add text displaying level and which index this is
			}
		}

		if (render != this.active){
			if (render){
				scene.add(this.mesh as Mesh);
				this.active = true;
			}
			else{
				scene.remove(this.mesh as Mesh);
				this.active = false;
			}
		}
	}


	// Helper funtion for our specific context of an unmoving map at the origin. 
	// Should definately consider generalizing and doing all work with Vec3's 
	AsVec3(vec : Vector2) { return new Vector3(vec.x, vec.y, 0)}
}

class rect{
	min : Vector2;
	max : Vector2;

	constructor(min:Vector2, max:Vector2){
		this.min = min;
		this.max = max;
	}
	/*constructor(center:Vector2, size:Vector2){
		let halfSize = size.divideScalar(2);
		this.min = center.sub(halfSize);
		this.max = center.add(halfSize);
	}*/

	intersects(other:rect){
		// Adapted from https://www.geeksforgeeks.org/find-two-rectangles-overlap/
		let l1 = this.min;
		let r1 = this.max;
		let l2 = other.min;
		let r2 = other.max;

		if (l1.x > r2.x || l2.x > r1.x)
			return false;
 
		if (r1.y > l2.y || r2.y > l1.y)
			return false;
 
		return true;
	}

	area(){
		let size = this.max.sub(this.min);
		return size.x + size.y
	}
}


/* Proposed rules:
	-Start at top level
		-Add to render stack
		-Check if exactly one of children's center is in frustum
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
			

	-Observations
		-This is wrong
		-Camera containing the center of a node does not mean parent's center will
		-oof

	-Second proposal
		-Project frustum onto plane
		-Get rect representing projection (would not be true for projection camera, would need improved)
		-Include all nodes whose bounds intersect with input rect
			-Put limiter on what levels to load (cant have camera observing full map try to load every L10)
				-Use (cameraBoundsArea / nodeArea) to determine if should load
					-Rough metric, try .25 for now
					-Prompt suggests using more data, like how far away the zone is from the camera 
						-magnitude of camerapos - center of tile would be a good huristic for further subdivision
		-No longer makes sense to use a stack, as the nodes will diverge much easier
*/

export default App;

const app = new App();
app.init();