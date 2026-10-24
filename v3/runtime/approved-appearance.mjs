// Independently exported PSD materials; shared by authoring and conversation.
export function applyApprovedAppearance(model,state={},mode='approved-neutral'){
 if(!model)return;
 const jacket=['approved-neutral','jacket-without-tie','lower-material-exchange'].includes(mode),legacyShirt=['approved-neutral','lower-material-exchange'].includes(mode);
 const foreground={r:-(state['arm.r.elbow']??0)>.25||-(state['arm.r.upper']??0)>.15,l:(state['arm.l.elbow']??0)>.25||(state['arm.l.upper']??0)>.15};
 for(const part of model.meshes){
  const g=part.authoring.group,id=part.id;let visible=false;part.opacity=1;part.order=part.authoring.baseOrder??part.order;
  if(g==='10_BODY_identity')visible=id!=='BODY_hand_viewer_left'&&id!=='BODY_hand_viewer_right'&&id!=='BODY_hand_viewer_left_edge_recovered_motion';
  if(g==='30_HAND_volar_materials'||g==='31_HAND_front_registered'||g==='34_HAND_side_skin')visible=true;
  if(g==='32_BODY_wrist_underlaps'){
   visible=true;const side=part.authoring.side,suffix=side==='r'?'left':'right',shirt=model.meshes.find(m=>m.authoring.role==='shirt-sleeve'&&m.authoring.side===side),coat=model.meshes.find(m=>m.id==='WARDROBE_jacket_sleeve_viewer_'+suffix);part.order=foreground[side]?88.8:Math.min(shirt?.authoring.baseOrder??part.authoring.baseOrder,coat?.authoring.baseOrder??part.authoring.baseOrder)-.3;
  }
  if(g==='33_SHIRT_cuff_facings'){visible=true;const side=id.includes('left')?'r':'l',cuff=model.meshes.find(m=>m.id==='WARDROBE_shirt_cuff_viewer_'+(side==='r'?'left':'right'));const coat=model.meshes.find(m=>m.id==='WARDROBE_jacket_sleeve_viewer_'+(side==='r'?'left':'right'));part.order=foreground[side]?89.9:Math.min(cuff.authoring.baseOrder,coat.authoring.baseOrder)-.1;}
  if(g==='28_FACE_eyelids_painted'){const side=id.endsWith('_r')?'r':'l';part.opacity=(state['eye.'+side+'.blink']??0)**3;visible=part.opacity>.001;}
  if(g==='29_FACE_skin_underlap'||id==='BODY_neck_collar_underlap')visible=true;
  if(g==='27_FACE_mouth_hidden')visible=(state['mouth.open']??0)>.001;
  if(g==='26_JOINT_fabric_underlaps'){const side=id.includes('left')?'r':'l';visible=jacket&&Math.abs(state['arm.'+side+'.upper']??0)>.025;}
  if(g==='20_WARDROBE_jacket'){visible=jacket;if(id.includes('sleeve_viewer')){const side=id.includes('left')?'r':'l';if(foreground[side])part.order=90;}}
  if(g==='22_WARDROBE_tie')visible=['approved-neutral','shirt-with-tie','lower-material-exchange'].includes(mode);
  if(g==='23_WARDROBE_lower')visible=mode==='approved-neutral'||mode==='jacket-without-tie';
  if(g==='21_WARDROBE_shirt'){visible=id==='WARDROBE_shirt'?legacyShirt:true;if(id.includes('cuff_viewer')&&foreground[id.includes('left')?'r':'l'])part.order=91;}
  if(g==='24_SHIRT_photographic_fabric_completion'){visible=!legacyShirt||part.authoring.role==='shirt-sleeve';if(part.authoring.role==='shirt-sleeve'&&foreground[part.authoring.side])part.order=89;}
  if(g==='25_LOWER_waist_underlap')visible=['shirt-with-tie','shirt-without-tie','lower-material-exchange'].includes(mode);
  if(part.authoring.kind==='registered-original-front-and-painted-palm-volume'||part.authoring.kind==='registered-hand-side-wall'){const side=part.authoring.side,cuff=model.meshes.find(m=>m.id==='WARDROBE_shirt_cuff_viewer_'+(side==='r'?'left':'right'));part.order=foreground[side]?90.95:cuff.authoring.baseOrder-.05;}
  part.visible=visible;
 }
}
