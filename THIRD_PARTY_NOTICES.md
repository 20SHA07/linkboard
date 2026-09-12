# QR encoder

`public/qr.mjs` embeds QRCode for JavaScript, copyright (c) 2009 Kazuhiko Arase, as distributed by qrcode-terminal 0.12.0. The original generator uses the MIT license; qrcode-terminal is distributed under Apache License 2.0. Both license texts and the original source notices are preserved inside the bundled file.

Source: https://github.com/gtanner/qrcode-terminal

The browser wrapper and SVG output helper were added for this application. No terminal-rendering code is used, and QR generation makes no external requests.

# Motion Primitives

`public/interface-motion.mjs` contains native adaptations of the selection-background, group-entrance, and panel-transition patterns from [ibelick/motion-primitives](https://github.com/ibelick/motion-primitives). The adaptations use measured DOM rectangles and the Web Animations API instead of React, Motion, and Tailwind. The original React components are not bundled or installed.

Source revision: `40f59b61e567712aa8329c7dc8c2ced763054c34`.

- [AnimatedBackground](https://github.com/ibelick/motion-primitives/blob/40f59b61e567712aa8329c7dc8c2ced763054c34/components/core/animated-background.tsx)
- [AnimatedGroup](https://github.com/ibelick/motion-primitives/blob/40f59b61e567712aa8329c7dc8c2ced763054c34/components/core/animated-group.tsx)
- [TransitionPanel](https://github.com/ibelick/motion-primitives/blob/40f59b61e567712aa8329c7dc8c2ced763054c34/components/core/transition-panel.tsx)

MIT License

Copyright (c) 2024 ibelick

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
