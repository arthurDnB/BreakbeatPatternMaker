# MP3 encoder attribution

`lamejs.js` is the unmodified ESM distribution from `@breezystack/lamejs` 1.2.7, published under LGPL-3.0. It is loaded as a separate browser module only when MP3 export is requested. The package's notice is in `LAMEJS-LICENSE.txt` and the complete license text is in `LGPL-3.0.txt`; upstream source and package history are at https://github.com/shijinyu/lamejs.

The application supplies 44.1 kHz stereo PCM from the same renderer used for WAV, then encodes it at 192 kbps in a Web Worker. MP3 encoder delay and padding mean an exported MP3 is not an exact seamless loop; export WAV when exact loop boundaries matter.
