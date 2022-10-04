import resolve from '@rollup/plugin-node-resolve'; // locate and bundle dependencies in node_modules (mandatory)
import { terser } from "rollup-plugin-terser"; // code minification (optional)
import merge from 'deepmerge';
import { createBasicConfig } from '@open-wc/building-rollup';

const baseConfig = createBasicConfig();

export default merge(baseConfig, {
	input: './out-tsc/src/app.js',
	output: [
		{
			format: 'umd',
			name: 'Slippy Map',
			file: 'build/bundle.js'
		}
	],
	plugins: [ resolve(), terser() ]
});