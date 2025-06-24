import gulp from "gulp";
import ts from "gulp-typescript";
import sourcemaps from "gulp-sourcemaps";
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
import fs from "fs-extra";

const tsProject = ts.createProject("tsconfig.json");
const sass = gulpSass(dartSass);

const staticFiles = [
	'assets',
	'lang',
	'module.json',
	'templates',
	'README.md',
	'LICENSE'
];

export function scripts() {
    return gulp.src('module/**/*.ts')
		.pipe(sourcemaps.init())
		.pipe(tsProject())
		.pipe(sourcemaps.write())
        .pipe(gulp.dest('dist/module'));
}

export function styles() {
	return gulp.src([`scss/**/*.scss`], { base: `scss` })
		.pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(sass({
			outputStyle: "compressed",
			silenceDeprecations: ['legacy-js-api', 'import'],
		}).on("error", sass.logError))
		.pipe(sourcemaps.write("."))
		.pipe(gulp.dest(`dist/styles`));
}

async function copyFiles() {
	for (const file of staticFiles) {
		if (fs.existsSync(file)) {
			await fs.copy(file, `dist/${file}`);
		}
	}
}

export function watch() {
    gulp.watch('module/**/*.ts', scripts);
    gulp.watch('scss/**/*.scss', styles);
	gulp.watch(
		staticFiles,
		{ ignoreInitial: false },
		copyFiles,
	);
}

export const build = gulp.series(scripts, styles, copyFiles);
