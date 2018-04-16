(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['exports'], factory);
  } else if (typeof exports === 'object') {
    // CommonJS
    factory(exports);
  }

  root.CLIP = factory()

})((typeof window === 'object' && window) || this, function() {
  // 工具类方法
  const util = {
    /**
     * 文件转化成 dataURL字符串
     * @param  {File}     file File文件
     * @param  {Function} fn   回调方法，包含一个dataURL字符串参数
     */
    file2DataURL(file, fn) {
      let reader = new FileReader()
      reader.onloadend = function(e) {
        fn.loaded(e.target.result)
      }

      reader.onloadstart = function (e) {
        fn.start(e)
      }

      reader.onprogress = function (e) {
        fn.progress(e)
      }

      reader.readAsDataURL(file)
    },

    /**
     * dataURL转换成Image类型文件
     * @param  {String}   dataURL dataURL字符串
     * @param  {Function} fn      回调方法，包含一个Image类型参数
     */
    dataURL2Image(dataURL, fn) {
      let img = new Image()
      img.onload = function() {
        fn(img)
      }
      img.src = dataURL
    },

    /**
     * dataURL转换成File类型文件
     * @param  {String}   dataURL dataURL字符串
     * @return {File}
     */
    dataURL2File(dataURL, name = '') {
      let arr = dataURL.split(',')
      let mime = arr[0].match(/:(.*?);/)[1]
      let bstr = atob(arr[1])
      let n = bstr.length
      let u8arr = new Uint8Array(n)

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
    canvas2Blob(canvas, quality = 1, fn) {
      canvas.toBlob(function(blob) {
        fn(blob)
      }, this.mini, quality)
    },

    /**
     * 将canvas转换成dataURL字符串
     * @param  {HTML CANVAS DOM}   canvas  html canvas DOM
     * @param  {Number}   quality  0到1的图片质量数值
     * @return {String}
     */
    canvas2DataURL(canvas, quality = 1) {
      return canvas.toDataURL(this.mini, quality)
    }
  }

  // 图片裁剪
  const CLIP = function (options) {
    return new CLIP.fn.init(options)
  }

  CLIP.fn = CLIP.prototype = {
    constructor: CLIP,
    init: function (options) {
      this.options = Object.assign({
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
      }, options)

      this._DISTANCE = 160
      this._CONTAINER = null // container容器
      this._MASK = null // 背景遮罩
      this._LOADING = null // loading提示
      this._CANVAS_WRAPPER = null // canvas父容器
      this._CANVAS = null // canvas画布
      this._CANCEL_BTN = null // 取消按钮
      this._CONFIRM_BTN = null // 确认按钮
      this._IMAGE = null // 要截取的图片
      this._FILE = null // 原始文件
      this._MINI_SCALE = null // 图片最小缩放比例
      this._SCALE = null // 图片当前的缩放比例
      this._IS_TOUCHING = false // 是否处于操作中
      this._TRANSITION = {
        x: 0,
        y: 0
      } // 当前图片的位置
      this._POS = null // 当前的touch记录
      this._ROTATE = this.getRotate(this.options.orientation)  // 当前图片的旋转角度
    }
  }

  CLIP.fn.init.prototype = CLIP.fn

  /**
   * 获取旋转角度
   * @param  {Number} orientation Image的Orientation信息
   * @return {Number}
   */
  CLIP.fn.getRotate = function (orientation) {
    let deg = 0

    switch (orientation) {
    case 3:
      deg = 180
      break
    case 6:
      deg = 90
      break
    case 8:
      deg = -90
      break
    default:
      null
    }

    return deg
  }

  /**
   * 获取canvas到宽高
   * @return {Object}
   */
  CLIP.fn.getCanvasSize = function () {
    let width = Math.min(window.innerWidth, window.innerHeight) - 4
    let height = width / this.options.ratio

    if ((height + this._DISTANCE) > window.innerHeight) {
      height = window.innerHeight - this._DISTANCE
      width = parseInt(height * this.options.ratio)
    }

    return {width, height}
  }

  /**
   * 获取图片的最小缩放比例
   * @param  {Image} image  要渲染的图片
   * @param  {Number} deg   图片旋转角度
   * @return {Number}
   */
  CLIP.fn.getMinScale = function (image, deg) {
    let {width, height} = this.getCanvasSize()
    let minScale = null

    switch(deg) {
    case -90:
      minScale = Math.max(width / image.height, height / image.width)
      break
    case 90:
      minScale = Math.max(width / image.height, height / image.width)
      break
   case 180:
      minScale = Math.max(width / image.width, height / image.height)
      break
    default:
      minScale = Math.max(width / image.width, height / image.height)
      break
    }

    minScale = Math.ceil(minScale * 100000) / 100000
    return minScale
  }

  /**
   * 创建加载提示
   * @return {HTMLElement}
   */
  CLIP.fn.createLoading = function () {
    let loading = document.createElement('div')
    let style = `position: absolute;left: 0; top: 40%; z-index: ${this.options.zIndex + 1}; width: 100%; font-size: 16px;color: #fff;text-align: center;`
    loading.setAttribute('style', style)
    loading.innerText = '加载中···'
    return loading
  }

  /**
   * 创建画布
   * @param  {Image} image   要渲染的图片
   * @param  {Deg} rotate    图片旋转的角度
   * @param  {Number} cw     被剪切图像的宽度
   * @param  {Number} ch     被剪切图像的高度
   * @return {HTMLElement}
   */
  CLIP.fn.createCanvas = function (image, rotate, cw, ch, scale) {
    console.log(rotate)
    let width = cw || image.width
    let height = ch || image.height
    let canvas = document.createElement('canvas')
    let ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height
    canvas.style.display = 'block'
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.rotate(rotate * Math.PI / 180)

    let {x, y} = this._TRANSITION

    switch (rotate) {
    case -90:
      y -= image.width * this._SCALE
      ctx.translate(y, x)
      break;
    case 90:
      x -= image.height * this._SCALE
      ctx.translate(y, x)
      break;
    case 180:
      x -= image.width * this._SCALE
      y -= image.height * this._SCALE
      ctx.translate(x, y)
      break;
    default:
      ctx.translate(x, y)
    }

    ctx.scale(scale, scale)
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height)
    ctx.restore()
    return canvas
  }

  /**
   * 创建裁剪容器
   * @return {HTMLElement}
   */
  CLIP.fn.createContainer = function () {
    let container = document.createElement('div')
    let style = `position: fixed; left: 0; top:0; z-index: ${this.options.zIndex}; ` +
      `width: 100%; height: 100%; background-color: ${this.options.backgroundColor};user-select:none;`
    container.setAttribute('style', style)
    return container
  }

  /**
   * 创建遮罩层
   * @return {HTMLElement}
   */
  CLIP.fn.createMask = function () {
    let mask = document.createElement('div')
    let style = `position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: ${this.options.zIndex};`
    mask.setAttribute('style', style)
    return mask
  }

  /**
   * 创建按钮
   * @return {Object}
   */
  CLIP.fn.createBtns = function () {
    let btnWrapper = document.createElement('div')
    let style = `position: fixed; left: 0; bottom: 0; z-index: ${this.options.zIndex + 3}; width: 100%;`
    btnWrapper.setAttribute('style', style)

    let btnStyle = `width: 50%; height:42px; line-height: 42px; text-align: center; background-color: ${this.options.btnTheme}; color: #fff; float: left; font-size: 14px;`
    let cancelBtn = document.createElement('div')
    cancelBtn.setAttribute('style', btnStyle)
    cancelBtn.innerText = '取消'

    let confirmBtn = document.createElement('div')
    confirmBtn.setAttribute('style', btnStyle)
    confirmBtn.innerText = '确定'

    btnWrapper.appendChild(cancelBtn)
    btnWrapper.appendChild(confirmBtn)

    return { cancelBtn, confirmBtn, btnWrapper }
  }

  /**
   * 创建canvas父容器
   * @return {HTMLElement}
   */
  CLIP.fn.createCanvasWrapper = function () {
    let {width, height} = this.getCanvasSize()
    let canvasWrapper = document.createElement('div')
    let style = `position:fixed; left: ${(window.innerWidth - width) / 2}px; top: ${(window.innerHeight - height - 50) / 2}px; z-index: ${this.options.zIndex + 1};border:1px solid ${this.options.clipColor};`
    canvasWrapper.setAttribute('style', style)
    return canvasWrapper
  }

  /**
   * 显示图片裁剪窗口
   * @param  {FILE} file file类型的参数
   */
  CLIP.fn.show = function (file) {
    if (!/^image\/[jpe?g|png|gif]/.test(file.type)) {
      this.options.error ? this.options.error(`this.show need a picture but the ${file.type} is received.`) : null
      return null
    }

    let {width, height} = this.getCanvasSize()

    this._FILE = file
    this._CONTAINER = this.createContainer()
    this._MASK = this.createMask()
    this._LOADING = this.createLoading()
    this._CANVAS_WRAPPER = this.createCanvasWrapper()
    let { cancelBtn, confirmBtn, btnWrapper } = this.createBtns()

    util.file2DataURL(file, {
      loaded: (dataURL) => {
        util.dataURL2Image(dataURL, (image) => {
          this._IMAGE = image
          this._MINI_SCALE = this.getMinScale(image, this._ROTATE)
          this._SCALE = this._MINI_SCALE
          this._CANVAS = this.createCanvas(image, this._ROTATE, width, height, this._SCALE)

          // 创建按钮

          this._CANCEL_BTN = cancelBtn
          this._CONFIRM_BTN = confirmBtn

          // 添加DOM到视图
          this._CANVAS_WRAPPER.appendChild(this._CANVAS)
          this.addEvents()
        })
      },
      start: (data) => {
        this._CONTAINER.appendChild(this._MASK)
        this._CONTAINER.appendChild(this._LOADING)
        this._CONTAINER.appendChild(this._CANVAS_WRAPPER)
        this._CONTAINER.appendChild(btnWrapper)
        document.body.appendChild(this._CONTAINER)
      },
      progress: (data) => {
        console.log(data)
      }
    })
  }

  /**
   * 销毁
   */
  CLIP.fn.destroy = function () {
    if (this.options.beforeDestroy) {
      this.options.beforeDestroy()
    }

    this._CONTAINER = null
    this._MASK = null
    this._LOADING = null
    this._CANVAS_WRAPPER = null
    this._CANVAS = null
    this._CANCEL_BTN = null
    this._CONFIRM_BTN = null
    this._IMAGE = null
    this._FILE = null
    this._MINI_SCALE = null
    this._SCALE = null
    this._IS_TOUCHING = false
    this._TRANSITION = {
      x: 0,
      y: 0
    }
    this._POS = null
    this._ROTATE = 0
  }

  /**
   * 添加监听事件
   */
  CLIP.fn.addEvents = function () {
    // 容器添加阻止默认事件
    this._MASK.addEventListener('touchstart', (e) => {
      e.preventDefault()
    })

    // canvas touchstart
    this._CANVAS.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._IS_TOUCHING = true
      this._POS = this.setPos(e.touches)
    }, false)

    // canvas touchmove
    this._CANVAS.addEventListener('touchmove', (e) => {
      if (!this._IS_TOUCHING) return null

      if (this._POS.length === 2 && e.touches.length) {
        this.setScale(this._POS, e.touches)
        this.setTranstion(this._POS[0], this._POS[0], this._ROTATE)
      } else {
        this.setTranstion(this._POS[0], this.setPos(e.touches)[0], this._ROTATE)
      }

      let {x, y} = this._TRANSITION
      this.canvasRender(x, y, this._SCALE, this._ROTATE)

      this._POS = this.setPos(e.touches)
    })

    // canvas touchmove
    this._CANVAS.addEventListener('touchend', (e) => {
      this._IS_TOUCHING = false
    })

    // canvas touchcancel
    this._CANVAS.addEventListener('touchcancel', (e) => {
      this._IS_TOUCHING = false
    })

    // save
    this._CONFIRM_BTN.addEventListener('click', (e) => {
      if (this.options.save) {
        if (this.options.expect === 'blob') {
          util.canvas2Blob(this._CANVAS, 1, (blob) => {
            this.options.save(blob)
            document.body.removeChild(this._CONTAINER)
            this.destroy()
          })
        } else if (this.options.expect === 'file') {
          let dataURL = util.canvas2DataURL(this._CANVAS, 1)
          let file = util.dataURL2File(dataURL, this.name)
          this.options.save(file)
          document.body.removeChild(this._CONTAINER)
          this.destroy()
        } else {
          let dataURL = util.canvas2DataURL(this._CANVAS, 1)
          this.options.save(dataURL)
          document.body.removeChild(this._CONTAINER)
          this.destroy()
        }
      } else {
        document.body.removeChild(this._CONTAINER)
        this.destroy()
      }
    })

    // cancel
    this._CANCEL_BTN.addEventListener('click', (e) => {
      document.body.removeChild(this._CONTAINER)
      this.destroy()
    })
  }

  /**
   * 画布重绘
   * @param  {Number} x      画布x轴的移动距离
   * @param  {Number} y      画布Y轴的移动距离
   * @param  {Number} scale  画布的缩放
   * @param  {Number} rotate 画布的旋转值
   */
  CLIP.fn.canvasRender = function (x, y, scale, rotate) {
    let ctx = this._CANVAS.getContext('2d')
    ctx.clearRect(0, 0, this._CANVAS.width, this._CANVAS.height)
    ctx.save()
    ctx.rotate(rotate * Math.PI / 180)

    switch (rotate) {
    case -90:
      y -= this._IMAGE.width * this._SCALE
      ctx.translate(y, x)
      break
    case 90:
      x -= this._IMAGE.height * this._SCALE
      ctx.translate(y, x)
      break
    case 180:
      x -= image.width * this._SCALE
      y -= image.height * this._SCALE
      ctx.translate(x, y)
      break
    default:
      ctx.translate(x, y)
    }

    ctx.scale(scale, scale)
    ctx.drawImage(this._IMAGE, 0, 0, this._IMAGE.width, this._IMAGE.height, 0 , 0 , this._IMAGE.width, this._IMAGE.height)
    ctx.restore()
  }

  /**
   * 设置开始位置
   */
  CLIP.fn.setPos = function (pos) {
    let temp = {}

    Object.keys(pos).forEach((key) => {
      temp[key] = {
        pageX: pos[key].pageX,
        pageY: pos[key].pageY
      }
    })

    temp['length'] = pos.length

    return temp
  }

  /**
   * 设置画布的缩放值
   * @param {Touches} start 开始的手势数据
   * @param {Touches} end   结束的手势数据
   */
  CLIP.fn.setScale = function (start, end) {
    let xx1 = Math.pow(start[1].pageX - start[0].pageX, 2)
    let yy1 = Math.pow(start[1].pageY - start[0].pageY, 2)
    let l1 = Math.sqrt(xx1 + yy1)

    let xx2 = Math.pow(end[1].pageX - end[0].pageX, 2)
    let yy2 = Math.pow(end[1].pageY - end[0].pageY, 2)
    let l2 = Math.sqrt(xx2 + yy2)

    let scale = this._SCALE * l2 / l1
    this._SCALE = scale < this._MINI_SCALE ? this._MINI_SCALE : scale
  }

  /**
   * 设置画布的X、Y的移动距离
   * @param {Touch} start   开始的手势数据
   * @param {Touch} end     结束的手势数据
   * @param {Number} rotate 画布的旋转值
   */
  CLIP.fn.setTranstion = function (start, end, rotate) {
    let x = 0
    let y = 0
    let imgWidth = 0
    let imgHeight = 0

    switch (rotate) {
    case -90:
      x = (end.pageX - start.pageX) + this._TRANSITION.x
      y = (start.pageY - end.pageY) + this._TRANSITION.y
      imgWidth = this._IMAGE.height * this._SCALE
      imgHeight = this._IMAGE.width * this._SCALE

      if (x > 0) {
        x = 0
      } else if (Math.abs(x)+ this._CANVAS.width > imgWidth) {
        x = this._CANVAS.width - imgWidth
      }

      if (y < 0) {
        y = 0
      } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
        y = imgHeight - this._CANVAS.height
      }

      break
    case 90:
      x = (start.pageX - end.pageX) + this._TRANSITION.x
      y = (end.pageY - start.pageY) + this._TRANSITION.y
      imgWidth = this._IMAGE.height * this._SCALE
      imgHeight = this._IMAGE.width * this._SCALE

      if (x < 0) {
        x = 0
      } else if (Math.abs(x)+ this._CANVAS.width > imgWidth ) {
        x = imgWidth - this._CANVAS.width
      }

      if (y > 0) {
        y = 0
      } else if (Math.abs(y) + this._CANVAS.height > imgHeight ) {
        y = this._CANVAS.height - imgHeight
      }

      break
    case 180:
      x = (start.pageX - end.pageX) + this._TRANSITION.x
      y = (start.pageY - end.pageY) + this._TRANSITION.y

      imgWidth = this._IMAGE.width  * this._SCALE
      imgHeight = this._IMAGE.height * this._SCALE

      if (x < 0) {
        x = 0
      } else if (Math.abs(x)+ this._CANVAS.width > imgWidth) {
        x = imgWidth - this._CANVAS.width
      }

      if (y < 0) {
        y = 0
      } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
        y = imgHeight - this._CANVAS.height
      }

      break
    default:
      x = (end.pageX - start.pageX) + this._TRANSITION.x
      y = (end.pageY - start.pageY) + this._TRANSITION.y

      imgWidth = this._IMAGE.width  * this._SCALE
      imgHeight = this._IMAGE.height * this._SCALE

      if (x > 0) {
        x = 0
      } else if (Math.abs(x)+ this._CANVAS.width > imgWidth) {
        x = this._CANVAS.width - imgWidth
      }

      if (y > 0) {
        y = 0
      } else if (Math.abs(y) + this._CANVAS.height > imgHeight) {
        y = this._CANVAS.height - imgHeight
      }
    }

    this._TRANSITION = {x, y}
  }

  return CLIP
})