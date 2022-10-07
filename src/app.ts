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
	Raycaster,
	Line,
	Line3,
	Plane
} from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Should be moved to the app class
let camera:PerspectiveCamera, scene:Scene, renderer:WebGLRenderer, controls:OrbitControls, map:Map;

let plane : Mesh;

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
		camera = new PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
		//camera = new OrthographicCamera(-1,1,-1,1,.1,10);
		camera.position.z = 4;

		controls = new OrbitControls( camera, renderer.domElement );
		controls.minPolarAngle = Math.PI / 4;
		controls.maxPolarAngle = Math.PI * 3 / 4;

		//controls.minAzimuthAngle = -.1 * Math.PI;
		//controls.maxAzimuthAngle =  .1 * Math.PI;

		scene = new Scene();

		const geometry = new BoxGeometry();
		const material = new MeshBasicMaterial();
		material.color = new Color("#114477");

		// Base geometry
		const mesh = new Mesh( geometry, material );
		mesh.rotateX(Math.PI)
		scene.add( mesh );

		map = new Map(scene);

		controls.addEventListener("change", () => map.Update(camera));

		animate();
	}
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	//camera.updateProjectionMatrix();

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
		//console.log(controls.getAzimuthalAngle() / Math.PI);

		let frustum = new Frustum().setFromProjectionMatrix(camera.projectionMatrix);

		this.CalculateFrustumPlane(frustum.planes[0], camera.position)
		this.CalculateFrustumPlane(frustum.planes[1], camera.position)

		console.log(frustum);

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

	// Helper function for getting a correct frustum
	// For whatever reason the camera planes all have
	// constants of zero when queried
	// This function will only work for perspective cameras,
	// where the cameras position is on the horizontal and 
	// vertical frustum planes
	CalculateFrustumPlane(p:Plane, cameraPosition:Vector3){
		p.constant = cameraPosition.dot(p.normal);
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
		this.maxSubdivisions = 3;
		this.minRatioToSubdivide = .25;
	}

	// This had to be revised so many times because
	//  A) ^ is not pow, it is a binary op
	//  B) divideScalar both returns and writes to the underying vec
	
	GetSizeAtLevel(level:number){
		let divisor = Math.pow(2, level + 1)
		let vec = new Vector2(this.size.x, this.size.y);
		vec.divideScalar(divisor);
		return vec;
	}

	GetHalfSizeAtLevel(level:number){
		return this.GetSizeAtLevel(level+1);
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

		let halfSize = center.clone().add(this.context.GetSizeAtLevel(level).divideScalar(2));

		this.bounds = new rect(center.clone().sub(halfSize), center.clone().add(halfSize));
		this.children = new Array(4).fill(null);

		console.log("Node [level:", this.level + ", center:", this.center.x + "," + center.y + "]");
	}
	
	GetChild(index:number) : QuadTreeNode {
		if (!this.children[index]){
			let childPositionOffset = this.context.GetHalfSizeAtLevel(this.level+1);

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


			console.log("Direction:",direction);
			console.log("OrigionalCenter:", this.center);
			
			// center + (offset * direction)
			let childCenter = this.center.clone().add(childPositionOffset.multiply(direction));


			console.log("ChildCenter:",childCenter);

			this.children[index] = new QuadTreeNode(this.context, this, this.level + 1, childCenter);
		}

		return this.children[index] as QuadTreeNode;
	}
	
	

	GetChildrenInRectRecursive(frustum:Frustum, nodeOutput:Array<QuadTreeNode>){
		
		console.log("left", frustum.planes[0]);
		console.log("right", frustum.planes[1]);

		// Planes are, in order, {left, right, top, bottom, near, far}
		let distanceToLeft1 = frustum.planes[0].distanceToPoint(this.AsVec3(this.bounds.max));
		let distanceToLeft2 = frustum.planes[0].distanceToPoint(this.AsVec3(this.bounds.min));
		let distanceToRight1 = frustum.planes[1].distanceToPoint(this.AsVec3(this.bounds.max));


		console.log("dl1:",distanceToLeft1);
		console.log("dl2:",distanceToLeft2);
		console.log("dr1:",distanceToRight1);

		// Checks to make sure that some of the rect is in the frustum
		if (distanceToLeft2 > 0 || distanceToRight1 > 0) {
			//return;
		}

		// TODO: this may lead to unexpected behavior for tiles that border the frustum
		distanceToLeft1 = Math.abs(distanceToLeft1);
		distanceToLeft2 = Math.abs(distanceToLeft2);
		distanceToRight1 = Math.abs(distanceToRight1);

		let frustumWidth = distanceToLeft1 + distanceToRight1;

		let horizontalRatio = (frustumWidth - distanceToLeft2 - distanceToRight1) / frustumWidth;

		console.log("Ratio @ L"+this.level+":", horizontalRatio);

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
				//this.mesh.parent = this.parent ? this.parent.mesh : null;
				this.mesh.position.set(this.center.x, this.center.y, 0);

				// Done to demonstrate that only required nodes are considered for rendering
				this.mesh.frustumCulled = false;
				
				// TODO: Add text displaying level and which index this is
				console.log("Alocating mesh for level", this.level);
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