'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['exports'], factory);
  } else if ((typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object') {
    // CommonJS
    factory(exports);
  }

  root.CLIP = factory();
})((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window || undefined, function () {
  // 工具类方法
  var util = {
    /**
     * 文件转化成 dataURL字符串
     * @param  {File}     file File文件
     * @param  {Function} fn   回调方法，包含一个dataURL字符串参数
     */
    file2DataURL: function file2DataURL(file, fn) {
      var reader = new FileReader();
      reader.onloadend = function (e) {
        fn.loaded(e.target.result);
      };

      reader.onloadstart = function (e) {
        fn.start(e);
      };

      reader.onprogress = function (e) {
        fn.progress(e);
      };

      reader.readAsDataURL(file);
    },


    /**
     * dataURL转换成Image类型文件
     * @param  {String}   dataURL dataURL字符串
     * @param  {Function} fn      回调方法，包含一个Image类型参数
     */
    dataURL2Image: function dataURL2Image(dataURL, fn) {
      var img = new Image();
      img.onload = function () {
        fn(img);
      };
      img.src = dataURL;
    },


    /**
     * dataURL转换成File类型文件
     * @param  {String}   dataURL dataURL字符串
     * @return {File}
     */
    dataURL2File: function dataURL2File(dataURL) {
      var name = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

      var arr = dataURL.split(',');
      var mime = arr[0].match(/:(.*?);/)[1];
      var bstr = atob(arr[1]);
      var n = bstr.length;
      var u8arr = new Uint8Array(n);

      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }

      return new File([u8arr], name, { type: mime });
    },


    /**
     * 将canvas转换成Blob类型的数据
     * @param  {HTML CANVAS DOM}   canvas  html canvas DOM
     * @param  {Number}   quality  0到1的图片质量数值
     * @param  {Function} fn      回调函数，包含一个BLOB类型的参数
     */
    canvas2Blob: function canvas2Blob(canvas) {
      var quality = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      var fn = arguments[2];

      canvas.toBlob(function (blob) {
        fn(blob);
      }, this.mini, quality);
    },


    /**
     * 将canvas转换成dataURL字符串
     * @param  {HTML CANVAS DOM}   canvas  html canvas DOM
     * @param  {Number}   quality  0到1的图片质量数值
     * @return {String}
     */
    canvas2DataURL: function canvas2DataURL(canvas) {
      var quality = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

      return canvas.toDataURL(this.mini, quality);
    }
  };

  // 图片裁剪
  var CLIP = function CLIP(options) {
    return new CLIP.fn.init(options);
  };

  CLIP.fn = CLIP.prototype = {
    constructor: CLIP,
    init: function init(options) {
      this.options = _extends({
        ratio: 1, // 宽高比 Number
        expect: 'base64',
        orientation: 1,
        zIndex: 999,
        clipColor: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 1)',
        btnTheme: '#1f1f1f',
        save: null,
        beforeDestroy: null,
        error: null
      }, options);

      this._DISTANCE = 160;
      this._CONTAINER = null; // container容器
      this._MASK = null; // 背景遮罩
      this._LOADING = null; // loading提示
      this._CANVAS_WRAPPER = null; // canvas父容器
      this._CANVAS = null; // canvas画布
      this._CANCEL_BTN = null; // 取消按钮
      this._CONFIRM_BTN = null; // 确认按钮
      this._IMAGE = null; // 要截取的图片
      this._FILE = null; // 原始文件
      this._MINI_SCALE = null; // 图片最小缩放比例
      this._SCALE = null; // 图片当前的缩放比例
      this._IS_TOUCHING = false; // 是否处于操作中
      this._TRANSITION = {
        x: 0,
        y: 0 // 当前图片的位置
      };this._POS = null; // 当前的touch记录
      this._ROTATE = this.getRotate(this.options.orientation); // 当前图片的旋转角度
    }
  };

  CLIP.fn.init.prototype = CLIP.fn;

  /**
   * 获取旋转角度
   * @param  {Number} orientation Image的Orientation信息
   * @return {Number}
   */
  CLIP.fn.getRotate = function (orientation) {
    var deg = 0;

    switch (orientation) {
      case 3:
        deg = 180;
        break;
      case 6:
        deg = 90;
        break;
      case 8:
        deg = -90;
        break;
      default:
        null;
    }

    return deg;
  };

  /**
   * 获取canvas到宽高
   * @return {Object}
   */
  CLIP.fn.getCanvasSize = function () {
    var width = Math.min(window.innerWidth, window.innerHeight) - 4;
    var height = width / this.options.ratio;

    if (height + this._DISTANCE > window.innerHeight) {
      height = window.innerHeight - this._DISTANCE;
      width = parseInt(height * this.options.ratio);
    }

    return { width: width, height: height };
  };

  /**
   * 获取图片的最小缩放比例
   * @param  {Image} image  要渲染的图片
   * @param  {Number} deg   图片旋转角度
   * @return {Number}
   */
  CLIP.fn.getMinScale = function (image, deg) {
    var _getCanvasSize = this.getCanvasSize(),
        width = _getCanvasSize.width,
        height = _getCanvasSize.height;

    var minScale = null;

    switch (deg) {
      case -90:
        minScale = Math.max(width / image.height, height / image.width);
        break;
      case 90:
        minScale = Math.max(width / image.height, height / image.width);
        break;
      case 180:
        minScale = Math.max(width / image.width, height / image.height);
        break;
      default:
        minScale = Math.max(width / image.width, height / image.height);
        break;
    }

    minScale = Math.ceil(minScale * 100000) / 100000;
    return minScale;
  };

  /**
   * 创建加载提示
   * @return {HTMLElement}
   */
  CLIP.fn.createLoading = function () {
    var loading = document.createElement('div');
    var style = 'position: absolute;left: 0; top: 40%; z-index: ' + (this.options.zIndex + 1) + '; width: 100%; font-size: 16px;color: #fff;text-align: center;';
    loading.setAttribute('style', style);
    loading.innerText = '加载中···';
    return loading;
  };

  /**
   * 创建画布
   * @param  {Image} image   要渲染的图片
   * @param  {Deg} rotate    图片旋转的角度
   * @param  {Number} cw     被剪切图像的宽度
   * @param  {Number} ch     被剪切图像的高度
   * @return {HTMLElement}
   */
  CLIP.fn.createCanvas = function (image, rotate, cw, ch, scale) {
    console.log(rotate);
    var width = cw || image.width;
    var height = ch || image.height;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.rotate(rotate * Math.PI / 180);

    var _TRANSITION = this._TRANSITION,
        x = _TRANSITION.x,
        y = _TRANSITION.y;


    switch (rotate) {
      case -90:
        y -= image.width * this._SCALE;
        ctx.translate(y, x);
        break;
      case 90:
        x -= image.height * this._SCALE;
        ctx.translate(y, x);
        break;
      case 180:
        x -= image.width * this._SCALE;
        y -= image.height * this._SCALE;
        ctx.translate(x, y);
        break;
      default:
        ctx.translate(x, y);
    }

    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);
    ctx.restore();
    return canvas;
  };

  /**
   * 创建裁剪容器
   * @return {HTMLElement}
   */
  CLIP.fn.createContainer = function () {
    var container = document.createElement('div');
    var style = 'position: fixed; left: 0; top:0; z-index: ' + this.options.zIndex + '; ' + ('width: 100%; height: 100%; background-color: ' + this.options.backgroundColor + ';user-select:none;');
    container.setAttribute('style', style);
    return container;
  };

  /**
   * 创建遮罩层
   * @return {HTMLElement}
   */
  CLIP.fn.createMask = function () {
    var mask = document.createElement('div');
    var style = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: ' + this.options.zIndex + ';';
    mask.setAttribute('style', style);
    return mask;
  };

  /**
   * 创建按钮
   * @return {Object}
   */
  CLIP.fn.createBtns = function () {
    var btnWrapper = document.createElement('div');
    var style = 'position: fixed; left: 0; bottom: 0; z-index: ' + (this.options.zIndex + 3) + '; width: 100%;';
    btnWrapper.setAttribute('style', style);

    var btnStyle = 'width: 50%; height:42px; line-height: 42px; text-align: center; background-color: ' + this.options.btnTheme + '; color: #fff; float: left; font-size: 14px;';
    var cancelBtn = document.createElement('div');
    cancelBtn.setAttribute('style', btnStyle);
    cancelBtn.innerText = '取消';

    var confirmBtn = document.createElement('div');
    confirmBtn.setAttribute('style', btnStyle);
    confirmBtn.innerText = '确定';

    btnWrapper.appendChild(cancelBtn);
    btnWrapper.appendChild(confirmBtn);

    return { cancelBtn: cancelBtn, confirmBtn: confirmBtn, btnWrapper: btnWrapper };
  };

  /**
   * 创建canvas父容器
   * @return {HTMLElement}
   */
  CLIP.fn.createCanvasWrapper = function () {
    var _getCanvasSize2 = this.getCanvasSize(),
        width = _getCanvasSize2.width,
        height = _getCanvasSize2.height;

    var canvasWrapper = document.createElement('div');
    var style = 'position:fixed; left: ' + (window.innerWidth - width) / 2 + 'px; top: ' + (window.innerHeight - height - 50) / 2 + 'px; z-index: ' + (this.options.zIndex + 1) + ';border:1px solid ' + this.options.clipColor + ';';
    canvasWrapper.setAttribute('style', style);
    return canvasWrapper;
  };

  /**
   * 显示图片裁剪窗口
   * @param  {FILE} file file类型的参数
   */
  CLIP.fn.show = function (file) {
    var _this = this;

    if (!/^image\/[jpe?g|png|gif]/.test(file.type)) {
      this.options.error ? this.options.error('this.show need a picture but the ' + file.type + ' is received.') : null;
      return null;
    }

    var _getCanvasSize3 = this.getCanvasSize(),
        width = _getCanvasSize3.width,
        height = _getCanvasSize3.height;

    this._FILE = file;
    this._CONTAINER = this.createContainer();
    this._MASK = this.createMask();
    this._LOADING = this.createLoading();
    this._CANVAS_WRAPPER = this.createCanvasWrapper();

    var _createBtns = this.createBtns(),
        cancelBtn = _createBtns.cancelBtn,
        confirmBtn = _createBtns.confirmBtn,
        btnWrapper = _createBtns.btnWrapper;

    util.file2DataURL(file, {
      loaded: function loaded(dataURL) {
        util.dataURL2Image(dataURL, function (image) {
          _this._IMAGE = image;
          _this._MINI_SCALE = _this.getMinScale(image, _this._ROTATE);
          _this._SCALE = _this._MINI_SCALE;
          _this._CANVAS = _this.createCanvas(image, _this._ROTATE, width, height, _this._SCALE);

          // 创建按钮

          _this._CANCEL_BTN = cancelBtn;
          _this._CONFIRM_BTN = confirmBtn;

          // 添加DOM到视图
          _this._CANVAS_WRAPPER.appendChild(_this._CANVAS);
          _this.addEvents();
        });
      },
      start: function start(data) {
        _this._CONTAINER.appendChild(_this._MASK);
        _this._CONTAINER.appendChild(_this._LOADING);
        _this._CONTAINER.appendChild(_this._CANVAS_WRAPPER);
        _this._CONTAINER.appendChild(btnWrapper);
        document.body.appendChild(_this._CONTAINER);
      },
      progress: function progress(data) {
        console.log(data);
      }
    });
  };

  /**
   * 销毁
   */
  CLIP.fn.destroy = function () {
    if (this.options.beforeDestroy) {
      this.options.beforeDestroy();
    }

    this._CONTAINER = null;
    this._MASK = null;
    this._LOADING = null;
    this._CANVAS_WRAPPER = null;
    this._CANVAS = null;
    this._CANCEL_BTN = null;
    this._CONFIRM_BTN = null;
    this._IMAGE = null;
    this._FILE = null;
    this._MINI_SCALE = null;
    this._SCALE = null;
    this._IS_TOUCHING = false;
    this._TRANSITION = {
      x: 0,
      y: 0
    };
    this._POS = null;
    this._ROTATE = 0;
  };

  /**
   * 添加监听事件
   */
  CLIP.fn.addEvents = function () {
    var _this2 = this;

    // 容器添加阻止默认事件
    this._MASK.addEventListener('touchstart', function (e) {
      e.preventDefault();
    });

    // canvas touchstart
    this._CANVAS.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _this2._IS_TOUCHING = true;
      _this2._POS = _this2.setPos(e.touches);
    }, false);

    // canvas touchmove
    this._CANVAS.addEventListener('touchmove', function (e) {
      if (!_this2._IS_TOUCHING) return null;

      if (_this2._POS.length === 2 && e.touches.length) {
        _this2.setScale(_this2._POS, e.touches);
        _this2.setTranstion(_this2._POS[0], _this2._POS[0], _this2._ROTATE);
      } else {
        _this2.setTranstion(_this2._POS[0], _this2.setPos(e.touches)[0], _this2._ROTATE);
      }

      var _TRANSITION2 = _this2._TRANSITION,
          x = _TRANSITION2.x,
          y = _TRANSITION2.y;

      _this2.canvasRender(x, y, _this2._SCALE, _this2._ROTATE);

      _this2._POS = _this2.setPos(e.touches);
    });

    // canvas touchmove
    this._CANVAS.addEventListener('touchend', function (e) {
      _this2._IS_TOUCHING = false;
    });

    // canvas touchcancel
    this._CANVAS.addEventListener('touchcancel', function (e) {
      _this2._IS_TOUCHING = false;
    });

    // save
    this._CONFIRM_BTN.addEventListener('click', function (e) {
      if (_this2.options.save) {
        if (_this2.options.expect === 'blob') {
          util.canvas2Blob(_this2._CANVAS, 1, function (blob) {
            _this2.options.save(blob);
            document.body.removeChild(_this2._CONTAINER);
            _this2.destroy();
          });
        } else if (_this2.options.expect === 'file') {
          var dataURL = util.canvas2DataURL(_this2._CANVAS, 1);
          var file = util.dataURL2File(dataURL, _this2.name);
          _this2.options.save(file);
          document.body.removeChild(_this2._CONTAINER);
          _this2.destroy();
        } else {
          var _dataURL = util.canvas2DataURL(_this2._CANVAS, 1);
          _this2.options.save(_dataURL);
          document.body.removeChild(_this2._CONTAINER);
          _this2.destroy();
        }
      } else {
        document.body.removeChild(_this2._CONTAINER);
        _this2.destroy();
      }
    });

    // cancel
    this._CANCEL_BTN.addEventListener('click', function (e) {
      document.body.removeChild(_this2._CONTAINER);
      _this2.destroy();
    });
  };

  /**
   * 画布重绘
   * @param  {Number} x      画布x轴的移动距离
   * @param  {Number} y      画布Y轴的移动距离
   * @param  {Number} scale  画布的缩放
   * @param  {Number} rotate 画布的旋转值
   */
  CLIP.fn.canvasRender = function (x, y, scale, rotate) {
    var ctx = this._CANVAS.getContext('2d');
    ctx.clearRect(0, 0, this._CANVAS.width, this._CANVAS.height);
    ctx.save();
    ctx.rotate(rotate * Math.PI / 180);

    switch (rotate) {
      case -90:
        y -= this._IMAGE.width * this._SCALE;
        ctx.translate(y, x);
        break;
      case 90:
        x -= this._IMAGE.height * this._SCALE;
        ctx.translate(y, x);
        break;
      case 180:
        x -= image.width * this._SCALE;
        y -= image.height * this._SCALE;
        ctx.translate(x, y);
        break;
      default:
        ctx.translate(x, y);
    }

    ctx.scale(scale, scale);
    ctx.drawImage(this._IMAGE, 0, 0, this._IMAGE.width, this._IMAGE.height, 0, 0, this._IMAGE.width, this._IMAGE.height);
    ctx.restore();
  };

  /**
   * 设置开始位置
   */
  CLIP.fn.setPos = function (pos) {
    var temp = {};

    Object.keys(pos).forEach(function (key) {
      temp[key] = {
        pageX: pos[key].pageX,
        pageY: pos[key].pageY
      };
    });

    temp['length'] = pos.length;

    return temp;
  };

  /**
   * 设置画布的缩放值
   * @param {Touches} start 开始的手势数据
   * @param {Touches} end   结束的手势数据
   */
  CLIP.fn.setScale = function (start, end) {
    var xx1 = Math.pow(start[1].pageX - start[0].pageX, 2);
    var yy1 = Math.pow(start[1].pageY - start[0].pageY, 2);
    var l1 = Math.sqrt(xx1 + yy1);

    var xx2 = Math.pow(end[1].pageX - end[0].pageX, 2);
    var yy2 = Math.pow(end[1].pageY - end[0].pageY, 2);
    var l2 = Math.sqrt(xx2 + yy2);

    var scale = this._SCALE * l2 / l1;
    this._SCALE = scale < this._MINI_SCALE ? this._MINI_SCALE : scale;
  };

  /**
   * 设置画布的X、Y的移动距离
   * @param {Touch} start   开始的手势数据
   * @param {Touch} end     结束的手势数据
   * @param {Number} rotate 画布的旋转值
   */
  CLIP.fn.setTranstion = function (start, end, rotate) {
    var x = 0;
    var y = 0;
    var imgWidth = 0;
    var imgHeight = 0;

    switch (rotate) {
      case -90:
        x = end.pageX - start.pageX + this._TRANSITION.x;
        y = start.pageY - end.pageY + this._TRANSITION.y;
        imgWidth = this._IMAGE.height * this._SCALE;
        imgHeight = this._IMAGE.width * this._SCALE;

        if (x > 0) {
          x = 0;
        } else if (Math.abs(x) + this._CANVAS.width > imgWidth) {
          x = this._CANVAS.width - imgWidth;
        }

        if (y < 0) {
          y = 0;
        } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
          y = imgHeight - this._CANVAS.height;
        }

        break;
      case 90:
        x = start.pageX - end.pageX + this._TRANSITION.x;
        y = end.pageY - start.pageY + this._TRANSITION.y;
        imgWidth = this._IMAGE.height * this._SCALE;
        imgHeight = this._IMAGE.width * this._SCALE;

        if (x < 0) {
          x = 0;
        } else if (Math.abs(x) + this._CANVAS.width > imgWidth) {
          x = imgWidth - this._CANVAS.width;
        }

        if (y > 0) {
          y = 0;
        } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
          y = this._CANVAS.height - imgHeight;
        }

        break;
      case 180:
        x = start.pageX - end.pageX + this._TRANSITION.x;
        y = start.pageY - end.pageY + this._TRANSITION.y;

        imgWidth = this._IMAGE.width * this._SCALE;
        imgHeight = this._IMAGE.height * this._SCALE;

        if (x < 0) {
          x = 0;
        } else if (Math.abs(x) + this._CANVAS.width > imgWidth) {
          x = imgWidth - this._CANVAS.width;
        }

        if (y < 0) {
          y = 0;
        } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
          y = imgHeight - this._CANVAS.height;
        }

        break;
      default:
        x = end.pageX - start.pageX + this._TRANSITION.x;
        y = end.pageY - start.pageY + this._TRANSITION.y;

        imgWidth = this._IMAGE.width * this._SCALE;
        imgHeight = this._IMAGE.height * this._SCALE;

        if (x > 0) {
          x = 0;
        } else if (Math.abs(x) + this._CANVAS.width > imgWidth) {
          x = this._CANVAS.width - imgWidth;
        }

        if (y > 0) {
          y = 0;
        } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
          y = this._CANVAS.height - imgHeight;
        }
    }

    this._TRANSITION = { x: x, y: y };
  };

  return CLIP;
});