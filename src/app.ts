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
	Plane,
	Object3D
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
		camera = new PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 100 );
		//camera = new OrthographicCamera(-1,1,-1,1,.1,10);
		camera.position.z = 4;

		controls = new OrbitControls( camera, renderer.domElement );
		controls.minPolarAngle = Math.PI / 4;
		controls.maxPolarAngle = Math.PI * 3 / 4;

		controls.minAzimuthAngle = -.1 * Math.PI;
		controls.maxAzimuthAngle =  .1 * Math.PI;

		scene = new Scene();

		map = new Map(scene);

		controls.addEventListener("change", () => map.Update(camera));
		//controls.addEventListener("change", () => map.RenderDebugLabels(camera, true));
		map.Update(camera);

		document.addEventListener("keydown", (event) => {
			console.log("key event", event);
			if (event.key == "r"){
				console.log("manually updating map");
				map.Update(camera)
			}
		} );

		console.log("finished init");
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
		// Get all nodes that must be rendered with given camera
		let requiredNodes = this.tree.GetNodeList(camera);

		let expiredNodes = this.activeNodeStack.filter(x => !requiredNodes.includes(x));
		
		expiredNodes.forEach(node => {
			node.SetToRender(false, this.scene);
		});

		requiredNodes.forEach(node => {
			node.SetToRender(true, this.scene);
		});

		this.activeNodeStack = requiredNodes;
	}

	RenderDebugLabels(camera:Camera, render:boolean){
		const labelContainer = document.querySelector('#labels');

		// remove all existing labels
		if (labelContainer == null) return;
		while (labelContainer.firstChild) {
			labelContainer.removeChild(labelContainer.firstChild);
		}

		this.tree.nodes.forEach(node => node.RenderText(camera, labelContainer));
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
	rootObject = new Object3D();
	// Position of center of tree
	position : Vector2;
	// Width and height of the tree at top level
	// Changing this would require rebuilding the tree
	size : Vector2;
	root : QuadTreeNode;
	nodes = new Array<QuadTreeNode>();
	colorA : Color;
	colorB : Color;
	maxSubdivisions : number;
	minRatioToSubdivide : number;

	constructor(position : Vector2, size : Vector2){
		this.position = position;
		this.size = size;
		this.root = new QuadTreeNode(this, null, 0, 0, position);

		this.colorA = new Color("#1f4260").multiplyScalar(1.4);
		this.colorB = new Color("#f3ff82");
		this.maxSubdivisions = 5;
		this.minRatioToSubdivide = .25;

		scene.add(this.rootObject);
	}

	// This had to be revised so many times because
	//  A) ^ is not pow, it is a binary op
	//  B) divideScalar both returns and writes to the underying vec
	
	GetSizeAtLevel(level:number){
		let divisor = Math.pow(2, level)
		let vec = new Vector2(this.size.x, this.size.y);
		vec.divideScalar(divisor);
		return vec;
	}

	GetHalfSizeAtLevel(level:number){
		return this.GetSizeAtLevel(level+1);
	}

	GetColorAtLevel(level:number, index:number){
		let color = this.colorA.clone().lerp(this.colorB, level / this.maxSubdivisions);
		color.sub(new Color(index / 32, 0, 0));
		return color;
	}

	GetNodeList(camera:Camera){
		this.nodes = new Array<QuadTreeNode>();
		
		this.root.GetChildrenInRectRecursive(camera, this.nodes);

		return this.nodes;
	}
}

class QuadTreeNode
{
	context : QuadTree;
	level : number;
	index : number;
	center : Vector2;
	cornerA : Vector3;
	cornerB : Vector3;
	active : boolean;
	parent : QuadTreeNode | null;
	children : Array<QuadTreeNode | null>;

	// Rendering / SceneGraph
	mesh : Mesh | null;

	constructor(context:QuadTree, parent : QuadTreeNode | null, level:number, index:number, center:Vector2){
		this.context = context;
		this.parent = parent;
		this.level = level;
		this.index = index;
		this.center = center;
		this.active = false;
		this.mesh = null;

		let halfSize = this.AsVec3(this.context.GetHalfSizeAtLevel(level));

		this.cornerA = this.AsVec3(center).sub(halfSize);
		this.cornerB = this.AsVec3(center).add(halfSize);

		this.children = new Array(4).fill(null);

		console.log("Node [level:", this.level + ", center:", this.center.x + "," + center.y + "]");
	}

	GetAddress(){
		let indexPath = new Array<string>();
		let p = this as QuadTreeNode | null;
		while(p?.parent != null){
			indexPath.push(p.level + ":" + p.index);
			p = p.parent;
		}

		return indexPath.reverse().join(", ");
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


			//console.log("Direction:",direction);
			//console.log("OriginalCenter:", this.center);
			
			// center + (offset * direction)
			let childCenter = this.center.clone().add(childPositionOffset.multiply(direction));


			//console.log("ChildCenter:",childCenter);

			this.children[index] = new QuadTreeNode(this.context, this, this.level + 1, index, childCenter);
		}

		return this.children[index] as QuadTreeNode;
	}
	
	

	GetChildrenInRectRecursive(camera:Camera, nodeOutput:Array<QuadTreeNode>){
		
		let screenSpaceA = this.cornerA.clone().project(camera);
		let screenSpaceB = this.cornerB.clone().project(camera);

		let area = screenSpaceA.sub(screenSpaceB).length();

		console.log(this.GetAddress() + " Area: " + area);

		if (area < this.context.minRatioToSubdivide){
			return;
		}

		nodeOutput.push(this);
		
		if (this.level >= this.context.maxSubdivisions){
			return;
		}

		for (let index = 0; index < 4; index++) {
			let node = this.GetChild(index);

			node.GetChildrenInRectRecursive(camera, nodeOutput);
		}
	}

	RenderText(camera:Camera, container:Element){
		if (this.mesh){
			let position = new Vector3();
			this.mesh.getWorldPosition(position);

			position.project(camera);

			const x = (position.x *  .5 + .5) * window.innerWidth;
			const y = (position.y * -.5 + .5) * window.innerHeight;

			const label = document.createElement("div");
			label.textContent = this.GetAddress();

			// move the elem to that position
			label.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;

			container.appendChild(label);
		}
	}

	SetToRender(render:boolean, scene : Scene){
		
		if (!this.mesh){
			if (render){
				const size = this.context.GetSizeAtLevel(this.level);
				const geometry = new PlaneGeometry(size.x, size.y);
				const material = new MeshBasicMaterial();
				material.color = this.context.GetColorAtLevel(this.level, this.index);
				this.mesh = new Mesh(geometry, material);
				this.mesh.position.set(this.center.x, this.center.y, .01 * this.level);

				// Done to demonstrate that only required nodes are considered for rendering
				this.mesh.frustumCulled = false;

				// Address Z fighting by manually setting render order.
				// Plausably not scalable in a more complex system

				// This does not seem to work for opaques,
				// so is instead adressed by z offset
				//this.mesh.renderOrder = this.level;
				
				// TODO: Add text displaying level and which index this is
				console.log("Alocating mesh for level", this.level);
				let vec = new Vector3();
				console.log("Position:", this.mesh.getWorldPosition(vec), "Size:", size.x, size.y)
			}
		}

		if (render != this.active){
			if (render){
				console.log("Adding to root (level", this.level + ")");
				this.context.rootObject.add(this.mesh as Mesh);
				this.active = true;
			}
			else{
				this.context.rootObject.remove(this.mesh as Mesh);
				this.active = false;
			}
		}
	}


	// Helper funtion for our specific context of an unmoving map at the origin. 
	// Should definately consider generalizing and doing all work with Vec3's 
	AsVec3(vec : Vector2) { return new Vector3(vec.x, vec.y, 0)}
}

export default App;

const app = new App();
app.init();