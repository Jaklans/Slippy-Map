# Slippy-Map

This is an implementation for a quadtree based map that can automatically subdivide as the camera changes position. Currently, it is still not properly rendering. More work needs to be done for tiles to process if they are in the camera's frustum, and whether they should subdivide based on what proportion of space they occupy

To observe the subdivision behavior, move the camera and hit the R key. The console will display some information, and the objects on screen will react (though not yet correctly)