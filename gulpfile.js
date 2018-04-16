const gulp = require('gulp')
const bable = require('gulp-babel')
const concat = require('gulp-concat')
const connect = require('gulp-connect')
const gulpSequence = require("gulp-sequence")
const gulpif = require('gulp-if')
const uglify = require('gulp-uglify')
const argv = require("yargs").argv;
const del = require('del')
const opn = require('opn')

const config = {
  js: ['src/core.js'],
  dist: 'dist',
  target: 'clip.js',
  port: 3001
}

gulp.task('clear', function () {
  del([config.dist]).then((paths) => {
    console.log(paths.join('\n'))
  })

  console.log('files an folders is deleted')
})

gulp.task('js', function () {
  return gulp
    .src(config.js, {base: 'src'})
    .pipe(concat(config.target))
    .pipe(bable({
      presets: ['es2015', "stage-2"],
      plugins: [["transform-object-assign"]]
    }))
    .pipe(gulpif(argv.p, uglify({
      compress: {
        drop_debugger: true
      }
    })))
    .pipe(gulp.dest(config.dist))
    .pipe(connect.reload())
})

//本地服务器  支持自动刷新页面
gulp.task('connect', function() {
  connect.server({
      root: __dirname,
      port: config.port,
      livereload: true
  })

  // if (!argv.p) {
  //   opn(`http://localhost:${config.port}/example/index.html`); // 启动服务后，打开demo页面
  // }
})

//监控文件变更
gulp.task("watch", function () {
  gulp.watch(["./src/**/*.*"], ["watchlist"]);
})

gulp.task("watchlist", ["clear"], function () {
  setTimeout(function () {
    gulpSequence("js")()
  }, 300)
});

gulp.task("default", ["clear"], function () {
  setTimeout(function () {
    if (argv.p) {
      gulpSequence("js")();
    } else {
      gulpSequence("js", "watch")();
    }
  }, 300)
});