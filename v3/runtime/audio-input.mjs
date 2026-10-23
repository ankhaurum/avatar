// Preserves the existing local-audio/test-tone behavior without importing its renderer.
export class AudioInput{
 constructor(){this.mode='none';this.envelope=0;this.generation=0;this.onError=()=>{};this.peak=0;}
 async ready(){this.context??=new AudioContext();await this.context.resume();}
 async attach(file){this.stop();this.peak=0;const generation=this.generation;await this.ready();if(generation!==this.generation)return;
  this.audio=new Audio();this.url=URL.createObjectURL(file);this.audio.src=this.url;this.audio.preload='auto';this.source=this.context.createMediaElementSource(this.audio);this.connect();
  this.audio.onended=()=>this.stop();this.audio.onerror=()=>{this.stop();this.onError('音声を読み込めません');};
  try{await this.audio.play();if(generation===this.generation)this.mode='local-audio';}catch(e){this.stop();throw e;}
 }
 connect(){this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.samples=new Float32Array(1024);this.source.connect(this.analyser);this.analyser.connect(this.context.destination);}
 async tone(){this.stop();this.peak=0;const generation=this.generation;await this.ready();if(generation!==this.generation)return;
  const n=Math.round(this.context.sampleRate*8),buffer=this.context.createBuffer(1,n,this.context.sampleRate),samples=buffer.getChannelData(0);
  for(let i=0;i<n;i++){const t=i/this.context.sampleRate,a=Math.max(0,Math.sin(t*12))**2*.15;samples[i]=(Math.sin(t*2*Math.PI*190)+.3*Math.sin(t*2*Math.PI*380))*a;}
  this.source=this.context.createBufferSource();this.source.buffer=buffer;this.connect();this.source.onended=()=>{if(generation===this.generation)this.stop();};this.source.start();this.mode='test-tone';
 }
 value(dt){let rms=0;if(this.mode!=='none'){this.analyser.getFloatTimeDomainData(this.samples);for(const v of this.samples)rms+=v*v;rms=Math.sqrt(rms/this.samples.length);}
  this.peak=Math.max(this.peak,rms);const target=Math.max(0,Math.min(1,(rms-.009)*7)),rate=target>this.envelope?30:14;this.envelope+=(target-this.envelope)*(1-Math.exp(-rate*dt));return this.envelope;
 }
 stop(){this.generation++;if(this.audio){this.audio.onended=null;this.audio.onerror=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}if(this.url)URL.revokeObjectURL(this.url);this.url=null;
  if(this.source){this.source.onended=null;try{this.source.stop?.();}catch{}this.source.disconnect();}this.analyser?.disconnect();this.source=null;this.mode='none';this.envelope=0;
 }
 dispose(){this.stop();this.context?.close();}
}
