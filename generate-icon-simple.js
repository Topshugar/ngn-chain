const fs=require('fs');
const html=`<canvas id=c width=512 height=512></canvas><script>
c=document.getElementById('c');x=c.getContext('2d');
x.fillStyle='#0a0a0a';x.fillRect(0,0,512,512);
x.fillStyle='#111';x.beginPath();x.roundRect(24,24,464,464,84);x.fill();
x.shadowColor='#00c076';x.shadowBlur=40;x.fillStyle='#00ff88';x.font='bold 300px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('₦',256,230);
x.shadowBlur=0;x.fillStyle='#00c076';x.font='bold 52px monospace';x.fillText('777',256,390);
setTimeout(()=>{let a=document.createElement('a');a.download='icon-512.png';a.href=c.toDataURL();a.click()},500)
<\/script>`;
fs.writeFileSync('temp-icon.html',html);
console.log('Open temp-icon.html - auto downloads icon-512.png');