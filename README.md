## 引入方式
``` bash
npm install mobile_clip

import CLIP from 'mobile_clip'

new CLIP(options).show('image file')
```

```
options: 配置如下
    ratio: 1, // 截图的宽高比 Number
    expect: 'base64', // 期待返回的类型 ['blob', 'file', 'base64']
    orientation: 1, // 图片的orientation信息，可以通过exif.js获取，用于处理图片的旋转问题
    zIndex: 999, // 弹出层的层级问题
    clipColor: '#ffffff', 
    backgroundColor: 'rgba(0, 0, 0, 1)',
    btnTheme: '#1f1f1f',
    save: null, // 确定回调
    beforeDestroy: null, // 取消回调
    error: null // 错误回调
``` 
