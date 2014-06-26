/*************************************************************
 *
 *  MathJax/extensions/Editor/editor.js
 *
 *  Allows editing of equations in MatJax output
 *  
 *  ---------------------------------------------------------------------
 *  
 *  Copyright (c) 2012 - 2013 Evgeny Savel'ev.
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

(function (HUB,HTML,AJAX,CALLBACK) 
{
	var VERSION = "0.1";

	var EXTENSION = MathJax.Extension;
	var ED = EXTENSION.Editor = 
		{
			version: VERSION,
			directory : "[MathJax]/extensions/Editor/",
			
			config : 
				{
					nbsp	: String.fromCharCode(160),
					OutputJax : "HTML-CSS",
					blinkDelay : 550,
					highlightingDelay : 200,
					MOUSEX : "clientX",
					MOUSEY : "clientY"
				},
			
			Config : function ()
				{
					document.addEventListener('click',ED.Event.documentClick,true);
					
					ED.Event.focusObj.blinkerSpan = HTML.Element("span", {style : {display:"inline-block", visibility : "hidden", width: "1px", position:"absolute", backgroundColor : "black",overflow: "hidden"}});
					
					ED.Event.focusObj.hiddenInput = HTML.Element("input",{style : {width: "0px",position:"absolute",top:"-1px",left:"-1px",height : "0px",opacity:"0",filter:"alpha(opacity=0)"},type:"text",name:"hiddenInputField"});
					
					ED.Event.MOUSEX = ED.config.MOUSEX;
					ED.Event.MOUSEY = ED.config.MOUSEY;
					
					HUB.Insert(ED.Event.signal,
						{
							Post: function (message,event,callback,remember) {
							  callback = CALLBACK(callback);
							  if (this.posting || this.pending) {
								this.Push(["Post",this,message,event,callback,remember]);
							  } else {
								this.callback = callback; callback.reset();
								if (remember) {this.posted.push([message,event])}
								this.Suspend(); this.posting = true;
								var result = this.listeners.Execute(message,event);
								/*if (ISCALLBACK(result) && !result.called) {WAITFOR(result,this)}*/
								this.Resume(); delete this.posting;
								if (!this.pending) {this.call()}
							  }
							  return callback;
							},
							ExecuteHooks: function (msg,event) {
							  var type = ((msg instanceof Array) ? msg[0] : msg);
							  if (!this.hooks[type]) {return null}
							  return this.hooks[type].Execute(event);
							}
						});
				},
				
			findFieldByName : function (name)
				{
					if(this.fieldList && Array.isArray(this.fieldList))
					{
						for (var i =0, lst = this.fieldList,m= lst.length;i<m;i++)
						{
							if(name == lst[i].name)
							{
								return lst[i];
							}
						}
					}
					return null;
				},
			
			findFieldById : function (id)
				{
					if(this.fieldList && Array.isArray(this.fieldList))
					{
						if(id>=0 && id < this.fieldList.length) {return this.fieldList[id]}
					}
					return null;
				}
		};

	var SETTINGS = HUB.config.EditorSettings,MML;

	var EVENT = ED.Event = {
		LEFTBUTTON: 0,           // the event.button value for left button
		RIGHTBUTTON: 2,          // the event.button value for right button
		MENUKEY: "altKey",       // the event value for alternate context menu
		
		MOUSEX : ED.config.MOUSEX,
		MOUSEY : ED.config.MOUSEY,

		Keydown: 	function (event) {return EVENT.Handler(event,"Keydown",this)},
		Keyup:		function (event) {return EVENT.Handler(event,"Keyup",this)},
		Keypress:	function (event) {return EVENT.Handler(event,"Keypress",this)},
		
		Mousedown:	function (event) {return EVENT.Handler(event,"Mousedown",this)},
		Mouseup:	function (event) {return EVENT.Handler(event,"Mouseup",this)},
		Mousemove:	function (event) {return EVENT.Handler(event,"Mousemove",this)},
		Mouseover:	function (event) {return EVENT.Handler(event,"Mouseover",this)},
		Mouseout:	function (event) {return EVENT.Handler(event,"Mouseout",this)},
		Click:		function (event) {return EVENT.Handler(event,"Click",this)},
		DblClick:	function (event) {return EVENT.Handler(event,"DblClick",this)},
		Menu:		function (event) {return EVENT.Handler(event,"ContextMenu",this)},
		Beep:		function (){this.focusObj.flashMRow()},

		Handler : function (event,type,math) 
			{
				if (!event) {event = window.event};
				if (ED.Event["Process"+type]) 
				{
					if (ED.Event.focusObj.jax)
					{
						if(ED.Event.focusObj.inputField.signal)
						{
							ED.Event.focusObj.jax.signal.Post(type,{event:event,jax:ED.Event.focusObj.jax,field:ED.Event.focusObj.inputField});
						}
						if(ED.Event.focusObj.jax.signal)
						{
							ED.Event.focusObj.jax.signal.Post(type,{event:event,jax:ED.Event.focusObj.jax,field:ED.Event.focusObj.inputField});
						}
						if(ED.Event.signal)
						{
							ED.Event.signal.Post(type,{event:event,jax:ED.Event.focusObj.jax,field:ED.Event.focusObj.inputField});
						}
					}
					return ED.Event["Process"+type].call(ED.Event,event,math)
				};
			},
		
		False: function (event) 
			{
				if (!event) {event = window.event}
				if (event) 
				{
					if (event.preventDefault) {event.preventDefault()}
					if (event.stopPropagation) {event.stopPropagation()}
					event.cancelBubble = true;
					event.returnValue = false;
				}
				return false;
			},
		
		ProcessMousemove : function (evt, math)
			{
				var obj = this.checkSpan(evt.target),
					XPos = evt[this.MOUSEX],
					YPos = evt[this.MOUSEY],
					objRect = obj.getBoundingClientRect(),
					def = {},
					side=-1;
	
				if (((XPos - objRect.left)/objRect.width)>1/2)
				{
					side = 1;
				}
				
		//		MathJax.Message.Set("Span: "+evt.target.id+"\nside: "+side,null,500);
				
				if ((this.highlightingObj.possibleHighlight)&&(((this.highlightingObj.startScreenX - XPos)^2 + (this.highlightingObj.startScreenY - YPos)^2)>100))
				{//The highlighting timer haven't fired yet, but the mouse is moved by at least 10 pixels distance
					this.highlightingObj.setinProgress(true);
				}

				if(this.highlightingObj.inProgress)
				{//We are selecting stuff
					if(this.highlightingObj.start==null)// it should not be
					{
						this.highlightingObj.setstart(this.focusObj.clickSpan);
						this.highlightingObj.setstartside(this.focusObj.clickSide);
					}
		
					this.highlightingObj.setend(obj);
					this.highlightingObj.setendside(side);
					this.highlightingObj.highlightNodes();
				}
				else if(this.highlightingObj.draggingOn)
				{
/*					if(editableobj)
					{
						if(isHighlighted(obj))
						{
							clearClassName(mathRoot,'draggignon');
							attachClassName(mathRoot,'draggignnodrop');
						}
						else
						{
							clearClassName(mathRoot,'draggignnodrop');
							attachClassName(mathRoot,'draggignon');
						}
					}
					else
					{
						clearClassName(mathRoot,'draggignon');
						attachClassName(mathRoot,'draggignnodrop');
					}*/
				}
				//Mouse is just moving
				if(math)
				{
/*					if (stylestring!=null)
					{
						var parentBlink=/blink-*parent/.test(stylestring),
							blinkLeftOnly=/blink-*\w*-*left/.test(stylestring),
							blinkRightOnly=/blink-*\w*-*right/.test(stylestring);
				
						//**********************************************DO NOW insert the code of finding the right item to blink	
				
						obj.removeAttribute('style');
	
						if (side=="right")
						{
							obj.setAttribute('style',stylestring.replace(/border.*[^;];/,"")+"border-right: 1px solid black ;");
						}
						else
						{
							obj.setAttribute('style',stylestring.replace(/border.*[^;];/,"")+"border-left: 1px solid black ;");
						}
					}
					else
					{
						if (side=="right")
						{
							obj.setAttribute('style',"border-right: 1px solid black ;");
						}
						else
						{
							obj.setAttribute('style',"border-left: 1px solid black ;");
						}
					}*/
				}
				return this.False(evt);
			},
		
		ProcessMouseup : function (evt, math)
			{
				var def = {};
				
				if (this.highlightingObj.possibleHighlight)
				{
					def.timer = null;
					def.possibleHighlight = false;
					this.highlightingObj.unHighlightNodes();
				}
				else if (this.highlightingObj.inProgress) 
				{
					def.timer = null;
					def.inProgress = false;
					def.possibleHighlight = false;
					def.draggingOn = false;
					def.possibleDrag = false;
					if (this.highlightingObj.direction ==0)
					{
						this.focusObj.resumeBlinking();
					}
					else
					{
						var bdef, mathItem;
						
						if ((this.highlightingObj.highlightedNodes)&&(this.highlightingObj.highlightedNodes.length>0))
						{
							bdef = {
								mRow : this.highlightingObj.highlightedNodes[0].findParentMRow(),
								clickSide : this.highlightingObj.direction,
							};
							if (this.highlightingObj.direction>0)
							{
								mathItem = this.highlightingObj.highlightedNodes[this.highlightingObj.highlightedNodes.length-1]
								bdef.toLeft = mathItem;
								bdef.clickSpan = document.getElementById("MathJax-Span-"+mathItem.spanID)
								bdef.toRight = mathItem.getNext();
							}
							else
							{
								mathItem = this.highlightingObj.highlightedNodes[0];
								bdef.toRight = mathItem;
								bdef.clickSpan = document.getElementById("MathJax-Span-"+mathItem.spanID)
								bdef.toLeft = mathItem.getPrevious();
							}
						}
						else
						{
							mathItem = this.highlightingObj.topleft;
							bdef = {
								mRow : mathItem.findParentMRow(),
								clickSide : this.highlightingObj.endside,
								clickSpan : this.highlightingObj.end
							};
							if (this.highlightingObj.endside>0)
							{
								bdef.toLeft = mathItem;
								bdef.toRight = mathItem.getNext();
							}
							else
							{
								mathitem = this.highlightingObj.highlightedNodes[0];
								bdef.toRight = mathItem;
								bdef.toLeft = mathItem.getPrevious();
							}
						}
						
						this.focusObj.setData(bdef);
						this.focusObj.startBlinking();
					}
				}
				else if (this.highlightingObj.draggingOn) 
				{
/*					var obj=evt.target,emptyContainerCheck=false;
		
					var hnl=highlightedNodes.length;
		
					mathDraggingOn=false;
					clearClassName(mathRoot,'draggignon');
					clearClassName(mathRoot,'draggignnodrop');

					//Drop everything if we can.
		
					var receivermrow=obj;
		
					var XPos = evt[this.MOUSEX];
					var YPos = evt[this.MOUSEY];
   
					var objRect = obj.getBoundingClientRect();
					var objTop = Math.round(objRect.top),
						objLeft = Math.round(objRect.left),
						objWidth = obj.scrollWidth,
						objHeight = obj.scrollHeight;	
		
					var side="left";
		
					if (!(/selectable/.test(obj.getAttribute('class'))))
					{
						receivermrow=findParentMRow(obj);
						if (((XPos-objLeft)/objWidth)>1/2)
						{
							if (obj.nextElementSibling)
							{
								obj=obj.nextElementSibling;
							}
							else
							{
								side="right";
							}
						}
					}
					else
					{
						if (((XPos-objLeft)/objWidth)>1/2)
						{
							obj=obj.lastElementChild;
							side="right";
						}
						else
						{
							obj=obj.firstElementChild;
						}
					}
		
					if((receivermrow!=null)&&(obj!=null))
					{
						if(!isHighlighted(obj))
						{
							var objParent=obj.parentNode;
				
							if(/empty/.test(receivermrow.getAttribute('class')))
							{
								emptyContainerCheck=true;
							}
				
							if(side=="left")
							{
								for (var i=0;i<hnl;i++)
								{
									objParent.insertBefore(highlightedNodes[i],obj);
								}
							}
							else
							{
								for (var i=0;i<hnl;i++)
								{
									objParent.appendChild(highlightedNodes[i]);
								}
							}
				
							mathBlinkSetUp(highlightedNodes[hnl-1],"right",receivermrow);
				
							if (mathDraggingObj.source.childElementCount<1)
							{//Container had become empty
								if (/selectable/.test(mathDraggingObj.source.getAttribute('class')))
								{
									insertEmptyElement(mathDraggingObj.source);
								}
							}
							else if ((mathDraggingObj.source.childElementCount==1)&&(/homogeneous/.test(mathDraggingObj.source.firstElementChild.getAttribute('class'))))
							{
								if (mathDraggingObj.source.firstElementChild.childElementCount<1)
								{//remove the empty <mrow> and make the parent <selectable mrow> empty
									mathDraggingObj.source.removeChild(mathDraggingObj.source.firstElementChild);
									insertEmptyElement(mathDraggingObj.source);
								}
							}
							if (emptyContainerCheck)
							{
								removeEmptyElement(receivermrow);
								receivermrow.setAttribute('class',receivermrow.getAttribute('class').replace(/\s*empty/,""));
							}
						}
					}	*/	
				}
				else
				{
					this.highlightingObj.unHighlightNodes();
				}
				this.highlightingObj.setData(def);
				
				return this.False(evt);
			},
		
		ProcessMousedown : function (evt, math)
			{
				if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey))
				{
				}
				else
				{
					if (evt.button==this.LEFTBUTTON)
					{//if left mouse button is pressed
						this.focusObj.suspendBlinking();
			
						var obj = this.checkSpan(evt.target),
							XPos = evt[this.MOUSEX],
							YPos = evt[this.MOUSEY],
							objRect = obj.getBoundingClientRect(),
							side=-1;
	
						if (((XPos - objRect.left)/objRect.width)>1/2)
						{
							side = 1;
						}
			
						if (this.highlightingObj.highlightedNodes.length==0)
						{
							if (evt.shiftKey)
							{//check if shift key was pressed
/*								mathHighlightingObj.start=mathBlinkingObj.obj;
								mathHighlightingObj.startside=mathBlinkingObj.side;
								if(mathHighlightingObj.start!=null)
								{
									mathHighlightingObj.end=obj;
									mathHighlightingObj.endside=side;
						
									highlightNodes("hlinprogress");
						
									try {clearTimeout( mathHighlightingTimer );} catch(e){};
									try {clearTimeout( mathDraggingTimer );} catch(e){};
						
									mathHighlightingInProgress=true;
								}*/
							}
							else
							{
								this.highlightingObj.setData({
										possibleHighlight: true,
										possibleDrag	 : false,
										jax			: HUB.getJaxFor(evt.currentTarget),
										start		: obj,
										startside	: side,
										end			: null,
										endside		: 0,
										startScreenX: XPos,
										startScreenY: YPos,
										timer		: setTimeout(CALLBACK(["setinProgress",this.highlightingObj,true]),ED.config.highlightingDelay) // Initiate highlighting after a delay
									});
							}
						}
						else
						{
/*							if (evt.shiftKey)
							{//check if shift key was pressed
								if(mathHighlightingObj.start!=null)
								{
									mathHighlightingObj.end=obj;
									mathHighlightingObj.endside=side;
						
									highlightNodes("hlinprogress");
						
									try {clearTimeout( mathHighlightingTimer );} catch(e){};
									try {clearTimeout( mathDraggingTimer );} catch(e){};
						
									if (highlightedNodes.length>0) mathHighlightingInProgress=true;
								}
								if (evt. preventDefault) evt.preventDefault();
							}
							else if(isHighlighted(obj))
							{// else, check if we have mousedown on the highlighted area, this begin the drag-n-drop
								mathDraggingObj.startScreenX=XPos;
								mathDraggingObj.startScreenY=YPos;
								mathDraggingObj.source=mathBlinkingObj.selectedMrow;

								try {clearTimeout( mathHighlightingTimer );} catch(e){};
								try {clearTimeout( mathDraggingTimer );} catch(e){};
					
								mathDraggingTimer=setTimeout(function (){mathDraggingOn=true;attachClassName(mathRoot,'draggignon');},200);

								if (evt. preventDefault) evt.preventDefault();
							}
							else
							{// else, check if we clicked on something not highlighted, possibly start new highlighting process
								mathHighlightingObj.start=obj;
								mathHighlightingObj.startside=side;
					
								try {clearTimeout( mathHighlightingTimer );} catch(e){};
								try {clearTimeout( mathDraggingTimer );} catch(e){};
					
								mathHighlightingTimer=setTimeout(function (){unHighlightNodes();mathHighlightingInProgress=true;},200);
					
								if (evt. preventDefault) evt.preventDefault();
							}*/
						}
						return this.False(evt);
					}
				}
			},
/*
function mathOnMouseOut(evt)
{
	var obj = evt.target,stylestring=obj.getAttribute('style');
	
	if((!mathHighlightingInProgress))
	{
		if (stylestring!=null)
		{
			obj.removeAttribute('style');
			obj.setAttribute('style',stylestring.replace(/background-color\s*:(.*)\s*;/,"").replace(/border.*[^;];/,""));
		}
	}
	else
	{
		if (stylestring!=null)
		{
			obj.setAttribute('style',stylestring.replace(/border.*[^;];/,""));
		}
	}
}
*/		
		ProcessClick : function (evt,math) 
			{
				if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey))
				{//Process clicks with modifiers
					this.Beep();
				}
				else
				{//Just a click. Mark an mrow as selected and show the blinker
					this.focusObj.blur();
					
					var span = evt.target, spanMRow = (evt.currentTarget)?(evt.currentTarget):(math), side = -1,
						jax = HUB.getJaxFor(span), def, 
						scr = document.getElementById(jax.inputID);
						spanRect = span.getBoundingClientRect();
					
					span = this.checkSpan(span);
					
					if (((evt[this.MOUSEX] - spanRect.left)/spanRect.width)>1/2)
					{
						side = 1;
					}
					
					def = this.focusObj.findMMLelements(span,spanMRow,jax,side);
					def.jax = jax;
					def.Script = scr;
					this.focusObj.setData(def);
					
					if(this.focusObj.inputField)
					{
						this.focusObj.startBlinking(span, spanMRow, side);
						if(this.focusObj.inputField.signal)
						{
							this.focusObj.inputField.signal.Post("Focus",{event:null,jax:this.focusObj.jax,field:this.focusObj.inputField});
						}
						if(this.focusObj.jax.signal)
						{
							this.focusObj.jax.signal.Post("Focus",{event:null,jax:this.focusObj.jax,field:this.focusObj.inputField});
						}
						if(this.signal)
						{
							this.signal.Post("Focus",{event:null,jax:this.focusObj.jax,field:this.focusObj.inputField});
						}
					}
					
					return this.False(evt);
				}
			},
			
		ProcessKeypress : function (evt,math)
			{
				var MML = MathJax.ElementJax.mml;
				
				if (this.focusObj.inputField)//Should be always true as we add and remove listeners when changing the focus.
				{
					var res=false,def = {}, mml, code=evt.charCode, charIn = String.fromCharCode(code);//which button was pressed
					if(!((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)))//Let the browsers deal with keystrokes
					{
						if(code>=32)
						{
							if (/([A-Z]|[a-z])/.test(charIn)) //Letters will be typeset as math identifiers
							{
								mml = MML.mi(MML.chars(charIn));
								this.focusObj.insertElements(mml);
								return this.False(evt);
							}
							else if (/\d|\./.test(charIn)) //Digits create rows of math numbers, dot is a digit
							{
								mml = MML.mn(MML.chars(charIn));
								this.focusObj.insertElements(mml);
								return this.False(evt);
							}
							else if (/[\+\-\*\/\^\_\=]/.test(charIn)) // [+] [-] [*] [/] [^] [_] [=] are creating operations
							{
								var template;
					
								switch(charIn)
								{
									case "/":
										template = {
											data : {
														type : "mfrac",
														consumeLeft : true,
														focusAt : 1
													}
										};
										res = this.focusObj.insertTemplate(template);
										break;
									case "^":
										template = {
											data : {
														type : "msup",
														consumeLeft : true,
														focusAt : 2
													}
										};
										res = this.focusObj.insertTemplate(template);
										break;
									case "_":
										template = {
											data : {
														type : "msub",
														consumeLeft : true,
														focusAt : 1
													}
										};
										res = this.focusObj.insertTemplate(template);
										break;
								}
								if(!res)
								{
									this.Beep();
									return;
								}
								return this.False(evt);
							}
							else
							{
								this.Beep();
							}
						}
						else if(code == 9)//Tab key
						{
							return this.False(evt);
						}
						else if(code == 13)//Enter key
						{
							return this.False(evt);
						}
						else if(code == 27)
						{
							return this.False(evt);
						}
					}
				}
			},
		
		ProcessKeydown : function (evt,math)
			{
				if (this.focusObj.inputField)//Should be always true as we add and remove listeners when changing the focus.
				{
					var def = {}, code=evt.keyCode;//which button was pressed
				
					if (code==8) //Backspace. TODO: Highlight complex objects before deletion, handle msup/msub nodes sequentially
					{
						this.focusObj.removeLeft();
					}
					else if (code==39) //Right arrow. TODO: process arrows with modifiers, like [shift] + [->] or [Ctrl] + [->]
					{
						if (this.focusObj.toLeft)
						{
							def = this.focusObj.toLeft.parent.focusOutToRightFromChild(this.focusObj.toLeft,def)
						}
						else if (this.focusObj.toRight)
						{
							def = this.focusObj.toRight.focusLeftToRight(this.focusObj.toRight,def);
						}
						else {def = this.focusObj.mRow.focusOutToRight(this.focusObj.mRow,def)}

						this.focusObj.setData (def);
						this.focusObj.repositionBlinker();
						if(this.highlightingObj.highlightedNodes.length>0)
						{
							this.highlightingObj.unHighlightNodes();
						}
						return this.False(evt);
					}
					else if (code==37) //Left arrow. TODO: process arrows with modifiers, like [shift] + [<-] or [Ctrl] + [<-]
					{
						if (this.focusObj.toRight)
						{
							def = this.focusObj.toRight.parent.focusOutToLeftFromChild(this.focusObj.toRight,def)
						}
						else if (this.focusObj.toLeft)
						{
							def = this.focusObj.toLeft.focusRightToLeft(this.focusObj.toLeft,def);
						}
						else {def = this.focusObj.mRow.focusOutToLeft(this.focusObj.mRow,def)}

						this.focusObj.setData (def);
						this.focusObj.repositionBlinker();
						if(this.highlightingObj.highlightedNodes.length>0)
						{
							this.highlightingObj.unHighlightNodes();
						}
						return this.False(evt);
					}
				}
			},
		
		documentClick : function (evt)
			{
				if((evt)&&(evt.target))
				{
					if(!evt.target.isMathJax)// Click is not on math object
					{
						if(ED.Event.focusObj.mRow)//if any math object holds focus, blur the focus and cancel the event
						{
							ED.Event.focusObj.blur();
							return ED.Event.False(evt);
						}
					}
					else
					{// click is on a MathJax object
						var iterator = evt.target;
						while (iterator)
						{
							if(iterator.className == "math") {iterator = null;}
							else if(((iterator.EDisInputField)&&(iterator.EDisInputField==true))||(iterator.EDkeepFocus)) {return;}//We clicked on an object that can receive focus, let the event propagate further
							else {iterator = iterator.parentNode;}
						}
						if(ED.Event.focusObj.mRow)// no \inputfield parent have been found, blur the focus, if necessary
						{
							ED.Event.focusObj.blur();
							return ED.Event.False(evt);
						}
					}
				}
			},
			
		signal: MathJax.Callback.Signal("Editor"),
		Register: 
			{
				/* Editor will issue the events in a manner similar to javascript events.
				 * Listeners can be added with MathJax.Extension.Editor.Register.EventListener() with an interface similar to eventTarget.addEventListener()
				 * element - anything that identifies MathJax element (such as spanID, HTML-element, inputfield ID). 
				 *           If not provided, a listener to all event of that type is created (similar to capturing in javascript)
				 * eventType - Either one of these;
				 *             "Focus"
				 *             "Blur"
				 *             "Change"
				 *             "Keypress"
				 *             "Keydown"
				 *             "Keyup" e.t.c.
				 * callback - a function object that is called when the event is triggered
				 * priority - an optional parameter that alters the order of calling to the callbacks.
				 */
				EventListener: function (element, eventType, callback,priority) 
					{
						var jax, fieldObj, cb;
						
						if(element)
						{
							if(typeof element === 'string')
							{
								fieldObj = ED.findFieldByName();
							}
						
							if(fieldObj)
							{
								if(!fieldObj.signal) 
								{
									filedObj.signal = MathJax.Callback.Signal(fieldObj.fieldName + fieldObj.fieldId);
									HUB.Insert(filedObj.signal,
									{
										Post: function (message,event,callback,remember) {
										  callback = CALLBACK(callback);
										  if (this.posting || this.pending) {
											this.Push(["Post",this,message,event,callback,remember]);
										  } else {
											this.callback = callback; callback.reset();
											if (remember) {this.posted.push([message,event])}
											this.Suspend(); this.posting = true;
											var result = this.listeners.Execute(message,event);
											/*if (ISCALLBACK(result) && !result.called) {WAITFOR(result,this)}*/
											this.Resume(); delete this.posting;
											if (!this.pending) {this.call()}
										  }
										  return callback;
										},
										ExecuteHooks: function (msg,event) {
										  var type = ((msg instanceof Array) ? msg[0] : msg);
										  if (!this.hooks[type]) {return null}
										  return this.hooks[type].Execute(event);
										}
									});
								}
								
								if(fieldObj.jax)
								{
									jax = fieldObj.jax;
								}
								else
								{
									jax = HUB.getJaxFor("MathJax-Span-"+fieldObj.mml.spanID);
									fieldObj.jax = jax;
								}
								
								cb = CALLBACK([fieldObj,callback]);
								fieldObj.signal.MessageHook.apply(fieldObj.signal,[eventType,cb,priority]);
							}
							else
							{
								jax = HUB.getJaxFor(element);
								
								if(jax !== null)
								{
									if(!jax.signal) 
									{
										jax.signal = MathJax.Callback.Signal(jax.inputID);
										HUB.Insert(jax.signal,
										{
											Post: function (message,event,callback,remember) {
											  callback = CALLBACK(callback);
											  if (this.posting || this.pending) {
												this.Push(["Post",this,message,event,callback,remember]);
											  } else {
												this.callback = callback; callback.reset();
												if (remember) {this.posted.push([message,event])}
												this.Suspend(); this.posting = true;
												var result = this.listeners.Execute(message,event);
												/*if (ISCALLBACK(result) && !result.called) {WAITFOR(result,this)}*/
												this.Resume(); delete this.posting;
												if (!this.pending) {this.call()}
											  }
											  return callback;
											},
											ExecuteHooks: function (msg,event) {
											  var type = ((msg instanceof Array) ? msg[0] : msg);
											  if (!this.hooks[type]) {return null}
											  return this.hooks[type].Execute(event);
											}
										});
									}
									fieldObj.signal.MessageHook.apply(fieldObj.signal,[eventType, CALLBACK([fieldObj,callback]),priority]);
								}
							}
						}
						else
						{
							return ED.Event.signal.MessageHook.apply(ED.Event.signal,[eventType, CALLBACK([fieldObj,callback]),priority])
						}
					}
			},

		highlightingObj :
			{// This object holds and proceses events that simulate highlighting and drag and drop activities.
				jax					:null,
				highlightedNodes	:[],
				inProgress			:false,
				possibleHighlight	:false,
				timer				:null,
				
				start				:null,//Where did the selection start
				startside			:0,//On what side of the object it did 
				startTree			:[],//complete ancestry line to the top \inputfield
				end					:null,//Current object receiving mouseover events
				endside				:0,//on which side mouse hovers
				endTree				:[],//complete ancestry line to the top \inputfield
				
				topleft				:null,//leftmost unique parent element
				topleftIndex		:-1,
				topright			:null,//rightmost unique parent element
				toprightIndex		:-1,
				topparent			:null,//least common ancestor
				
				draggingOn			:false,
				possibleDrag		:false,
				draggingTimer		:null,
				startScreenX		:0,
				startScreenY		:0,
				source				:null,
	
				insertedObj			:null,
				
				direction			:0,
				
				setinProgress : function (bool)
					{
						if(bool)
						{
							if((this.possibleHighlight) &&(!this.inProgress))this.inProgress = true;
							this.draggingOn = false;
							this.setpossibleHighlight(false);
							this.setpossibleDrag(false);
							this.settimer(null);
						}
						else
						{
							this.relabelHighlightedNodes();
							this.inProgress = false;
							this.draggingOn = false;
							this.setpossibleHighlight(false);
							this.setpossibleDrag(false);
							this.settimer(null);
						}
					},
					
				setpossibleHighlight : function (bool)
					{
						this.possibleHighlight = bool;
					},
				
				setdraggingOn : function (bool)
					{
						if(bool)
						{
							this.draggingOn = true;
							this.inProgress = false;
							this.setpossibleHighlight(false);
							this.setpossibleDrag(false);
							this.setdraggingTimer(null);
						}
						else
						{
							this.draggingOn = false;
							this.inProgress = false;
							this.setpossibleHighlight(false);
							this.setpossibleDrag(false);
							this.setdraggingTimer(null);
						}
					},
					
				setpossibleDrag : function (bool)
					{
						this.possibleDrag = bool;
					},
				
				setData : function (data)
					{
						for (var id in data)
						{
							if (data.hasOwnProperty(id)) 
							{
								if(this[id])
								{
									if (this[id]!=data[id])
									{
										this["set"+id](data[id]);
									}
								}
								else this["set"+id](data[id]);
							}
						}
					},
				
				setjax : function (jax)
					{
						this.jax = jax;
					},
				
				settopparent : function (node)
					{
						this.topparent = node;
					},
					
				settopright : function (node)
					{
						this.topright = node;
					},
					
				settoprightIndex : function (i)
					{
						this.toprightIndex = i;
					},
					
				settopleft : function (node)
					{
						this.topleft = node;
					},
					
				settopleftIndex : function (i)
					{
						this.topleftIndex = i;
					},
					
				setstartside : function (side) {this.startside = side},
				setstartScreenX : function (x) {this.startScreenX = x},
				setstartScreenY : function (y) {this.startScreenY = y},
				setendside : function (side) {this.endside = side},
				
				setstartTree : function (tree) {this.startTree = tree},
				setendTree : function (tree) {this.endTree = tree},
				
				setstart : function (node)
					{
						this.start = node;
					},
					
				setend : function (node)
					{
						this.end = node;
					},
					
				setdraggingTimer : function (timerObj)
					{
						if (this.draggingTimer) {try{clearTimeout(this.draggingTimer)}catch(e){};}
						if (this.timer) {try{clearTimeout(this.timer)}catch(e){};this.timer=null}
						
						this.draggingTimer = timerObj;
					},
					
				settimer : function (timerObj)
					{
						if (this.draggingTimer) {try{clearTimeout(this.draggingTimer)}catch(e){};this.draggingTimer = null}
						if (this.timer) {try{clearTimeout(this.timer)}catch(e){}}
						
						this.timer = timerObj;
					},
				unHighlightNodes : function () 
					{
						var item, m=this.highlightedNodes.length;
						
						if(m>0)
						{
							for (i=0;i<m;i++)
							{
								item = this.highlightedNodes[i];
							
								if (item.EDisHighlighted)
								{
									delete item.EDisHighlighted;
									delete item.extraAttributes.ishighlighted;
									item.DOMSpan.removeAttribute("ishighlighted");
									item.DOMSpan.removeAttribute("hlinprogress");
									delete item.DOMSpan;
								}
							}
							this.highlightedNodes = [];
						}
					},
				
				relabelHighlightedNodes : function ()
					{
						var item;
						
						for (i=0,m=this.highlightedNodes.length;i<m;i++)
						{
							item = this.highlightedNodes[i];
							
							if (item.EDisHighlighted)
							{
								item.DOMSpan.setAttribute("ishighlighted","true");
								item.DOMSpan.removeAttribute("hlinprogress");
							}
						}
					},
				
				sethighlightedNodes : function () // adds the nodes to the highlightedNodes array
					{
						if(this.highlightedNodes)
						{
							if (this.highlightedNodes.length>0) this.unHighlightNodes();
							var item;
							if (arguments&&arguments[0])
							{
								for (i=0,m=arguments.length;i<m;i++)
								{
									item = arguments[i];
								
									if(item instanceof Array)
									{
										for (j=0,n=item.length;j<n;j++)
										{
											var itemitem = item[j];
										
											itemitem.EDisHighlighted = true;
											if (itemitem.extraAttributes) {itemitem.extraAttributes.ishighlighted = true}
											else itemitem.extraAttributes = {ishighilighted : true};
								
											itemitem.DOMSpan = document.getElementById ("MathJax-Span-"+itemitem.spanID);
											itemitem.DOMSpan.setAttribute("hlinprogress","true");
										}
										this.highlightedNodes.push.apply(this.highlightedNodes,item);
									}
									else
									{
										if(item.isa(MML.mbase))
										{
											item.EDisHighlighted = true;
											if (item.extraAttributes) {item.extraAttributes.ishighlighted = true}
											else item.extraAttributes = {ishighilighted : true};
								
											item.DOMSpan = document.getElementById ("MathJax-Span-"+item.spanID);
											item.DOMSpan.setAttribute("ishighlighted","true");
											this.highlightedNodes.push(item);
										}
									}
								}
							}
						}
						
					},
				
				findLCA :	function () //Finds least common ancestor of highlighted MML elements. Returns null if elements are not in a common \inputfield
					{
						var def = {topparent : null},
							MMLstart,MMLend;
						
						if(this.start && this.end)
						{				
							MMLstart = EVENT.locateCorrespondingMML(this.start,this.jax.root,this.startside)
							MMLend = EVENT.locateCorrespondingMML(this.end,this.jax.root,this.endside)
						
							if (this.start == this.end) 
							{
								def=
									{
										startTree 	: [MMLstart], 
										endTree 	: [MMLstart], 
										topleft 	: MMLstart,
										topleftIndex: 0,
										topright 	: MMLstart,
										toprightIndex: 0,
										topparent 	: MMLstart.parent
									};
								return def; //just to speed things up in the beginning of selection
							}
						
							var parent1list=[MMLstart],parent2list=[MMLend];
	
							var parentnode=MMLstart, mathRoot = null, l1,l2,i=1;
	
							while (!parentnode.EDisInputField)
							{// loop through all ancestors of start
								parentnode=parentnode.parent;
								parent1list.push(parentnode);
							}
							parentnode=MMLend;
							while (!parentnode.EDisInputField)
							{// loop through all ancestors of end
								parentnode=parentnode.parent;
								parent2list.push(parentnode);
							}
	
							l1=parent1list.length;
							l2=parent2list.length;
	
							while ((parent1list[l1-i]==parent2list[l2-i])&&(i<=l1)&&(i<=l2))
							{
								mathRoot=parent1list[l1-i];
								i++;
							}
						
							def = 
								{
									startTree 	: parent1list, 
									endTree 	: parent2list, 
									topleft 	: parent1list[l1-i],
									topleftIndex: l1-i,
									topright 	: parent2list[l2-i],
									toprightIndex: l2-i,
									topparent 	: mathRoot
								};
						}
						return def;
					},
					
				highlightNodes : function (def)
					{
						if((this.start)&&(this.end))
						{
							if (!def) def = {};
							this.setData(this.findLCA());
							
							if (this.topparent)
							{
								if (this.topparent.EDisAtomic)//the parent node cannot be broken into parts and will be highlighted as a whole
								{
									this.setData({highlightedNodes : [this.topparent]});
									return true;
								}
								
								if(this.start == this.end)//We are highlighting a single object
								{
									if (this.startside!=this.endside)
									{
										this.setData({highlightedNodes : [this.topleft]});
										
										this.direction = this.endside;
									
										return true;
									}
									else
									{
										this.setData({highlightedNodes : []});
										
										this.direction = 0;
									
										return true;
									}
								}
							
								//highlight the nodes stretching from start to end
								var indexes = this.topparent.getChildIndexes(this.topleft,this.topright),
									l,r,direction = 1, temp, templist, tempindex, nodes = [], stack = [],
									left, right, lefttree, righttree, lside, rside;
							
								l=indexes[0];
								r=indexes[1];
							
								if((l>-1)&&(r>-1))
								{
									if(l>r)//the selection is going backward
									{
										this.direction = -1;
										l=indexes[1];
										r=indexes[0];
										
										left = this.topright;
										right = this.topleft;
										
										leftindex = this.toprightIndex;
										rightindex = this.topleftIndex;
										
										righttree = this.startTree;
										lefttree = this.endTree;
										
										rightside = this.startside;
										leftside = this.endside;
									}
									else
									{
										this.direction = 1;
										right = this.topright;
										left = this.topleft;
										
										rightindex = this.toprightIndex;
										leftindex = this.topleftIndex;
										
										lefttree = this.startTree;
										righttree = this.endTree;
										
										leftside = this.startside;
										rightside = this.endside;
									}
								//process highlighting of the start nodes
									temp = left;
									tempindex = leftindex;
									templist = [];
									
									while ((!temp.EDisAtomic) && (tempindex>0))
									{
										tempindex--;
										temp = lefttree[tempindex];
										
										for (var j = 1, i = temp.getIndex()+1, m = temp.parent.data.length; i<m;i++,j++)
										{
											templist.push(temp.parent.data[m-j]);
										}
									}
									
									if (tempindex == 0)
									{// we have descended to the same level as the "selection-start" item. we should see if we need to included it
										if (leftside == -1) templist.push(temp);
									}
									else
									{// selection started on an item deeper in the tree, we just include the whole parent
										templist.push(temp);
									}
									
									for (var i=0, m=templist.length;i<m;i++)
									{
										nodes.push(templist[m-i-1]);
									}
								//highlight all the nodes in-between start and end
									for (var i = l+1, m=r; i<m;i++)
									{
										nodes.push(this.topparent.data[i]);
									}
								// process highlighting of the end-nodes
									temp = right;
									tempindex = rightindex;
									templist = [];
									
									while ((!temp.EDisAtomic) && (tempindex>0))
									{
										tempindex--;
										temp = righttree[tempindex];
										
										for (var j = 0, i = temp.getIndex(); j<i;j++)
										{
											templist.push(temp.parent.data[j]);
										}
									}
									
									if (tempindex == 0)
									{// we have descended to the same level as the "selection-end" item. we should see if we need to included it
										if (rightside == 1) templist.push(temp);
									}
									else
									{// selection started on an item deeper in the tree, we just include the whole parent
										templist.push(temp);
									}
									
									for (var i=0, m=templist.length;i<m;i++)
									{
										nodes.push(templist[i]);
									}
								//highlight all the nodes
									this.setData({highlightedNodes : nodes});
									
									return true;
								}
							}
						} 
						return false
					}
			},
			
		focusObj :
			{
				Init : function ()
					{
						MML = MathJax.ElementJax.mml;
						
						this.suspendBlinking();
						
						this.clearScript();
						
						this.clearjax();
						this.cleartoLeft();
						
						this.cleartoRight();
						
						this.clearmRow();
						
						this.clearinputField();
						
						this.clearblinkTimer();
						this.clearinsertAt();
				
						this.clearclickSpan();
						this.clearclickSide();
					},
				
				flashMRow : function()
					{
						if (this.mRow&&this.mRowSpan)
						{
							this.mRowSpan.setAttribute("flashed","true");		//Flash the mRow
							if(this.flashTimer) try {clearTimeout( this.flashTimer );} catch(e){};
							this.flashTimer=setTimeout(this.clearFlash,40);	//Clear the flash
						}
					},
					
				clearFlash : function()
					{
						if (EVENT.focusObj.mRow&&EVENT.focusObj.mRowSpan)
						{
							EVENT.focusObj.mRowSpan.removeAttribute("flashed");				//Clear the flash attribute
						}
					},
					
				clearScript		: function (){	this.scr			= null},
				setScript		: function (scr){this.scr			= scr},
				clearjax		: function (){	this.jax			= null},
				setjax			: function (jax){this.jax			= jax},
				clearinsertAt	: function (){	this.insertAt		= null},
				setinsertAt		: function (insertAt){this.insertAt= insertAt},
				clearclickSpan	: function (){	this.clickSpan		= null},
				setclickSpan	: function (clickSpan){this.clickSpan= clickSpan},
				clearclickSide	: function (){	this.clickSide		= 0},
				setclickSide	: function (clickSide){this.clickSide= clickSide},
				clearblinkTimer	: function (){	this.blinkTimer		= null},
				cleartoLeft		: function (){	this.toLeft			= null; if (this.toLeftSpan) {this.toLeftSpan.removeAttribute("lefthand")};this.toLeftSpan	= null;},
				settoLeft		: function (toLeft){this.toLeft	= toLeft; if (toLeft && toLeft.spanID) 
						{this.toLeftSpan 	= document.getElementById("MathJax-Span-"+this.toLeft.spanID);if (this.toLeftSpan) {this.toLeftSpan.setAttribute("lefthand","true")}}},
				cleartoRight	: function (){	this.toRight		= null; if (this.toRightSpan) {this.toRightSpan.removeAttribute("righthand")};this.toRightSpan	= null;},
				settoRight		: function (toRight){this.toRight	= toRight; if (toRight && toRight.spanID) 
						{this.toRightSpan 	= document.getElementById("MathJax-Span-"+this.toRight.spanID);if (this.toRightSpan) {this.toRightSpan.setAttribute("righthand","true")}}},
				clearmRow		: function ()
					{
						if (this.mRow) {delete(this.mRow.extraAttributes.focused)};
						this.mRow = null;
						if (this.mRowSpan) {this.mRowSpan.removeAttribute("focused")};
						try {this.mRowSpan.removeChild(this.blinkerSpan);this.mRowSpan.removeChild(hiddenInput);} catch(e){};
						this.mRowSpan = null;
					},
				setmRow			: function (mRow)
					{
						this.mRow = mRow;
						if (mRow && mRow.spanID) 				
						{
							this.mRowSpan 		= document.getElementById("MathJax-Span-"+this.mRow.spanID);
							if (this.mRowSpan) {document.activeElement.blur(); this.mRowSpan.setAttribute("focused","true"); this.mRowSpan.appendChild(this.hiddenInput);this.hiddenInput.focus();}
							if (this.mRow.extraAttributes) {this.mRow.extraAttributes["focused"]=true;}
							else {this.mRow.extraAttributes = {focused:true};}
						}
					},
				clearinputField : function ()
					{
						if ( this.inputField) {delete(this.inputField.extraAttributes.selected)};
						this.inputField		= null;
						if (this.fieldSpan) 
						{
/*							try
							{
								this.fieldSpan.removeEventListener("mousedown",ED.Event.Mousedown,true);
								this.fieldSpan.removeEventListener("mouseup",ED.Event.Mouseup,true);
								this.fieldSpan.removeEventListener("mousemove",ED.Event.Mousemove,true);
							} catch(e) {};*/
							try{this.fieldSpan.removeAttribute("selected");} catch(e){};
							try
							{
								document.removeEventListener('keydown',ED.Event.Keydown,true);
								document.removeEventListener('keypress',ED.Event.Keypress,true);
							} catch(e){};
						}
						this.fieldSpan		= null;
					},
				setinputField : function (inputField)
					{
						this.inputField = inputField;
						if (inputField && inputField.spanID) 	
						{
							this.fieldSpan 	= document.getElementById("MathJax-Span-"+this.inputField.spanID);
							if(this.fieldSpan)
							{
								this.fieldSpan.setAttribute("selected","true");
								document.addEventListener('keydown',ED.Event.Keydown,true);
								document.addEventListener('keypress',ED.Event.Keypress,true);
							}
							if (this.inputField.extraAttributes) {this.inputField.extraAttributes["selected"]=true;}
							else {this.inputField.extraAttributes = {selected:true};};
						}
					},
				
				setData : function (data)
					{
						this.suspendBlinking();
						
						for (var id in data)
						{
							if (data.hasOwnProperty(id)) 
							{
								if(this[id])
								{
									if (this[id]!=data[id])
									{
										this["clear"+id]();
										this["set"+id](data[id]);
									}
								}
								else this["set"+id](data[id]);
							}
						}
					},
				
				flashTimer	: null,
				blinkerSpan : null,
				
				revealBlinker : function ()
					{
						if (this.blinkerSpan) {this.blinkerSpan.style.visibility = "visible";}
						//span.style.display = "inline-block";
						this.blinkTimer=setTimeout(CALLBACK([this,this.hideBlinker]),ED.config.blinkDelay);
					},
					
				hideBlinker	: function ()
					{
						if (this.blinkerSpan) {this.blinkerSpan.style.visibility = "hidden";}
						//span.style.display = "none";
						this.blinkTimer=setTimeout(CALLBACK([this,this.revealBlinker]),ED.config.blinkDelay);
					},
				
				repositionBlinker : function ()
					{
						if (this.blinkerSpan)
						{
							if (this.mRowSpan != this.blinkerSpan.parentNode)
							{
								if (this.blinkerSpan.parentNode) {try {this.blinkerSpan.parentNode.removeChild(this.blinkerSpan);} catch(e){};}
							
								this.blinkerSpan.style.top = "0px";
								this.mRowSpan.appendChild(this.blinkerSpan);
							
								var mRowSpanRect = this.mRowSpan.getBoundingClientRect(),
									blinkerSpanRect = this.blinkerSpan.getBoundingClientRect();
							
								this.blinkerSpan.style.top = Math.round(mRowSpanRect.top - blinkerSpanRect.top).toString() + "px";
								this.blinkerSpan.style.height = Math.round(mRowSpanRect.height).toString() + "px";
							}
							
							this.blinkerSpan.style.left = "0px";
							var blinkerSpanRect = this.blinkerSpan.getBoundingClientRect(),
								mathElementRect = this.clickSpan.getBoundingClientRect();
							
							if(this.clickSide == 1)
							{
								this.blinkerSpan.style.left = String(Math.round(mathElementRect.right - blinkerSpanRect.right) +.5) + "px";
							}
							else if(this.clickSide == -1)
							{
								this.blinkerSpan.style.left = String(Math.round(mathElementRect.left - blinkerSpanRect.left) -.5) + "px";
							}
							else
							{
								var mRowSpanRect = this.mRowSpan.getBoundingClientRect();
								this.blinkerSpan.style.left = String(Math.round(mRowSpanRect.left - blinkerSpanRect.left+0.5*mRowSpanRect.width) -.5) + "px";
							}
							
							this.resumeBlinking();
							return true
						}
						return false
					},
				
				startBlinking: function ()
					{
						if (this.blinkerSpan)
						{
							return this.repositionBlinker();
						}
						return false
					},
				
				resumeBlinking : function ()
					{
						if (this.blinkTimer) {try {clearTimeout( this.blinkTimer );} catch(e){};}
						if (this.blinkerSpan) {this.blinkerSpan.style.visibility = "visible";}
						this.blinkTimer=setTimeout(CALLBACK([this,this.hideBlinker]),ED.config.blinkDelay);
					},
					
				suspendBlinking : function ()
					{
						if(this.blinkTimer)
						{
							try {clearTimeout( this.blinkTimer );} catch(e){};
							if (this.blinkerSpan) {this.blinkerSpan.style.visibility = "hidden";}
							this.blinkTimer = null;
						}
					},
				
				removeLeft : function ()
					{
						if(EVENT.highlightingObj.highlightedNodes.length>0)
						{
							//TODO : remove the highlighted nodes;
						}
						else if(this.clickSpan)
						{
							var def = {},state;
							
							if(!this.toLeft&&this.toRight)
							{
								this.toLeft = this.toRight.getPrevious();
							}
							if(this.toLeft)
							{
								this.suspendBlinking();
								
								def = this.toLeft.DeleteFromRight(def);
							//	def = parent.RemoveAt(indx);

							}
							else if(this.toRight)
							{
								def = this.toRight.parent.removeLeftNeighbor(this.toRight,def);
							}
							else if(this.mRow.emptyMRow)
							{
								if(this.mRow.extraAttributes&&this.mRow.extraAttributes.EDisInputField)
								{
									EVENT.Beep();
								}
								else
								{
									if(this.mRow.parent.removePlaceHolder)
										def = this.mRow.parent.removePlaceHolder(this.mRow,def);
									else
										EVENT.Beep();
								}
							}
							else EVENT.Beep();
							
							if(def.clickSide||(def.clickSide==0))
							{
								state = {
									inputField 	: this.inputField,
									mRow		: this.mRow,
								};
								this.clearinputField();
								this.clearclickSpan();
								this.clearmRow();
								this.cleartoLeft();
								this.cleartoRight();
								this.scr.MathJax.elementJax.Rerender();
								//Since MathJax has scraped all old span elements, we have to look for the new clickSpan
								if(def.clickSide == 0)
								{
									def.clickSpan = document.getElementById("MathJax-Span-"+def.mRow.spanID);
								}
								else if(def.toLeft)
								{
									def.clickSpan = document.getElementById("MathJax-Span-"+def.toLeft.spanID);
									def.clickSide = 1;
								}
								else if(def.toRight)
								{
									def.clickSpan = document.getElementById("MathJax-Span-"+def.toRight.spanID);
									def.clickSide = -1;
								}
								def.inputField = state.inputField;
								if(!def.mRow) 
								{
									def.mRow = state.mRow;
								}
								this.setData (def);
								this.repositionBlinker();
							}
						}
					},
				
				insertElements : function ()
					{
						if (this.clickSpan)
						{
							var indx = -1,item,state,parent,def={};
							if (this.toLeft)
							{
								indx = this.toLeft.getIndex()+1;
								parent = this.toLeft.parent;
							}
							else if(this.toRight)
							{
								indx = this.toRight.getIndex();
								parent = this.toRight.parent;
							}
							else if(this.clickSide == 0)
							{
								indx = 0;
								parent = this.mRow;
							}
							if (indx>=0)
							{
								for(var i = 0, m = arguments.length;i<m;i++)
								{
									item = arguments[i];
								
									if (item instanceof MML.mbase)
									{
										this.suspendBlinking();
										def = parent.InsertAt(indx+i,item,def);
// 										this.scr.MathJax.state = MathJax.ElementJax.STATE.UPDATE;
// 										state = {
// 												scripts: [this.scr],                  // filled in by prepareScripts
// 												start: new Date().getTime(),  // timer for processing messages
// 												i: 0, j: 0,                   // current script, current jax
// 												//jax: {HTMLCSS : [this.scr]},                      // scripts grouped by output jax
// 												jaxIDs: [this.jax.outputJax]                    // id's of jax used
// 											};
// 										state.jax = {};
// 										state.jax[this.jax.outputJax] = [this.scr];
// 										HUB.queue.Push(["processOutput",HUB,state]);
										state = {
											inputField 	: this.inputField,
											mRow		: this.mRow,
										};
										this.clearinputField();
										this.clearclickSpan();
										this.clearmRow();
										this.cleartoLeft();
										this.cleartoRight();
										this.scr.MathJax.elementJax.Rerender();
										def = def.toLeft.focusInFromRight(def.toLeft,def);
										def.toRight = item.getNext();
										if(!def.inputField)
										{
											def.inputField = state.inputField;
										}
										if(!def.mRow)
										{
											def.mRow = state.mRow;
										}
										this.setData (def);
										this.repositionBlinker();
										if(EVENT.highlightingObj.highlightedNodes.length>0)
										{
											//TODO : replace the highlighted nodes;
											ED.highlightingObj.unHighlightNodes();
										}
									}
								}
							}
						}
						return null;
					},
				insertTemplate : function (tmpl)
					{
						var mml={},math,mrow,def={},indx,parent,focusPoint = 0,itemConsumed = false;
						 if (this.clickSpan)
						 {
						 	if(tmpl.latex)
						 	{//parse the latex template and insert the resulting mml at the focus point
						 	}
						 	else if(tmpl.mml)
						 	{//the mml is already created, insert it at the focus point
						 	}
						 	else if(tmpl.data)
						 	{
								if(EVENT.highlightingObj.highlightedNodes.length>0)
								{
									//TODO : replace the highlighted nodes;
									ED.highlightingObj.unHighlightNodes();
								}
								else
								{
									if(!this.toLeft)
									{
										if(this.toRight)
										{
											this.toLeft = this.toRight.getPrevious();
											if(!this.toLeft&& this.toRight.parent.EDisContainer)
											{
												this.toLeft = this.toRight.parent.getPrevious();
											}
										}
									}
									mml.toLeft = this.toLeft;
									mml.mRow = this.mRow;
									if(tmpl.data.consumeLeft) {mml.consumeLeft = tmpl.data.consumeLeft}
									if(tmpl.data.focusAt) {mml.focusAt = tmpl.data.focusAt}
									if(this[tmpl.data.type]) {mml = this[tmpl.data.type](mml)}
									if(mml&&mml.mml)
									{
										focusPoint = mml.focusPoint;
										indx = mml.indx;
										this.suspendBlinking();
										if(mml.doNotInsert) def.toLeft=this.toLeft;
										else def = mml.parent.InsertAt(indx,mml.mml,def);
										state = {
											inputField 	: this.inputField,
											mRow		: this.mRow,
										};
										this.clearinputField();
										this.clearclickSpan();
										this.clearmRow();
										this.cleartoLeft();
										this.cleartoRight();
										this.scr.MathJax.elementJax.Rerender();
										mml = mml.mml;
										if(mml.data && focusPoint && mml.data.length>focusPoint)
										{
											def = mml.data[focusPoint].focusInFromRight(mml,def);
										}
										else if(mml.data && mml.data.length>0)
										{
											def = mml.data[0].focusInFromRight(mml,def);
										}
										else
										{
											def = def.toLeft.focusInFromRight(def.toLeft,def);
										}
									
										if(!def.inputField)
										{
											def.inputField = state.inputField;
										}
										if(!def.mRow)
										{
											def.mRow = state.mRow;
										}
										this.setData (def);
										this.repositionBlinker();
										return true;
									}
								}
						 	}
						 }
						 return false;
					},

				blur : function ()
					{
						ED.Event.highlightingObj.unHighlightNodes();
						if(this.inputField&&this.inputField.signal)
						{
							this.inputField.signal.Post("Blur",{event:null,jax:this.jax,field:this.inputField});
						}
						if(this.jax&&this.jax.signal)
						{
							this.jax.signal.Post("Blur",{event:null,jax:this.jax,field:this.inputField});
						}
						if(ED.Event.signal)
						{
							ED.Event.signal.Post("Blur",{event:null,jax:this.jax,field:this.inputField});
						}
						this.Init();
					},
			
				findMMLelements : function (span, spanMRow, jax, side)
					{
						var iterator = jax.root, stack=[iterator],item, def = {clickSide : side, clickSpan : span},
							spanID = Number(span.id.replace("MathJax-Span-","")),
							spanMRowID = Number(spanMRow.id.replace("MathJax-Span-",""));
				
						if ((iterator)&&(iterator.spanID) && (iterator.spanID==spanMRowID))
						{// We have found the containing \inputfield
							def.inputField = iterator;
							def.mRow = iterator;
							def.insertAt = 0;
						}
						else
						{// iterate through the mml tree to find the \inputfield element
							while (stack.length>0)
							{
								iterator = stack.pop();
					
								if(iterator&&iterator.data)
								{
									for (var i=0, m=iterator.data.length;i<m;i++)
									{
										item = iterator.data[i];
							
										if (item && (item.spanID) && (item.spanID==spanMRowID))
										{
											def.inputField = item;
											def.mRow = item;
											def.insertAt = 0;
											iterator = item;
											stack = [];
											break;
										}
										else
										{
											stack.push(item);
										}
									}
								}
							}
						}
				
						if (((iterator.spanID) && (iterator.spanID==spanID))||(iterator.isEmptyMRow()))
						{// the click was on the \inputfield, try to figure out if we can focus on children
							if ((iterator.data)&&(iterator.data.length>0)&&(!iterator.isEmptyMRow())) 
							{
								if(side == 1)
								{
									item = iterator.data[iterator.data.length-1];
									item.focusInFromRight(iterator,def);
								}
								else
								{
									item = iterator.data[0];
									item.focusInFromLeft(iterator,def);
								}
							}
							else 
							{// this is an empty mrow, blink in the center
								def.toRight = null;
								def.toLeft = null;
								def.clickSide = 0;
							}
						}
						else
						{
							stack=[iterator];
							while (stack.length>0)
							{
								iterator = stack.pop();
						
								if(iterator && iterator.locateMMLhelper)
								{
									item = iterator.locateMMLhelper(spanID,stack,side,def);
									if (item!=null) 
									{
										if(def.clickSide == 1)
										{
											item.focusInFromRight(iterator,def);
										}
										else
										{
											item.focusInFromLeft(iterator,def);
										}
										stack = [];
										break;
									}
								}
								else if(iterator&&iterator.data)
								{
									for (var i=0, m=iterator.data.length;i<m;i++)
									{
										item = iterator.data[i];
							
										if (item&&(item.spanID) && (item.spanID==spanID))
										{
											if (side == 1)
											{
												item.focusInFromRight(iterator,def);
												if (i<m-1) {def.toRight = iterator.data[i+1];};
											}
											else
											{
												item.focusInFromLeft(iterator,def);
												if (i>0) {def.toLeft = iterator.data[i-1];};
											}
											def.mRow = item.findParentMRow();
											if (def.mRow.isEmptyMRow())
											{
												def.toRight = null;
												def.toLeft = null;
												def.clickSide = 0;
											}
											stack = [];
											break;
										}
										else
										{
											stack.push(item);
										}
									}
								}
							}
						}
			
						return def;
					},
				mfrac : function(def)
					{
						var math, num, mrow = MML.mrow(), itemConsumed, den = MML.mrow();
						if(def.toLeft)
						{
							if(def.consumeLeft)
							{
								math = def.toLeft.parent.produceLeftItem(def.toLeft);
								if(math && math.mml)
								{
									mrow.InsertAt(0,math.mml);
									def.indx = math.index;
									def.parent = math.parent;
									itemConsumed = true;
								}
								else //Should never happen, but just in case...
								{
									def.indx = def.toLeft.getIndex()+1;
									def.parent = def.toLeft.parent;
								}
							}
							else
							{
								def.indx = def.toLeft.getIndex()+1;
								def.parent = def.toLeft.parent;
							}
						}
						else
						{
							def.indx = 0;
							def.parent = def.mRow;
						}
						num = mrow;
						def.mml = MML.mfrac(num,den);
						if(itemConsumed)
						{
							if(def.focusAt) def.focusPoint = def.focusAt;
							else def.focusPoint = 1;
						}
						else
						{
							def.focusPoint = 0;
						}
						return def;
					},
				msup : function(def)
					{
						var math, base, mrow = MML.mrow(), itemConsumed, sup = MML.mrow();
						if(def.toLeft)
						{
							if(def.consumeLeft)
							{
								math = def.toLeft.parent.produceLeftItem(def.toLeft);
								if(math && math.mml)
								{
									def.indx = math.index;
									def.parent = math.parent;
									itemConsumed = true;
								}
								else //Should never happen, but just in case...
								{
									def.indx = def.toLeft.getIndex()+1;
									def.parent = def.toLeft.parent;
								}
							}
							else
							{
								def.indx = def.toLeft.getIndex()+1;
								def.parent = def.toLeft.parent;
							}
						}
						else
						{
							def.indx = 0;
							def.parent = def.mRow;
						}
						if(itemConsumed)
						{
							if((math.mml.type == "msubsup"))
							{
								base = math.mml;
								if(base.data[base.sup])
								{//double superscript, wrap it in ghost parentheses
									mrow.InsertAt(0,base);
									base = MML.mfenced(mrow).With(
																	{EDProperties : 
																		{
																			ghostElement:true,
																			open:{mathcolor:"gray"},
																			close:{mathcolor:"gray"}
																		}
																	});
									def.mml = MML.msubsup(base,null,sup);
									if(def.focusAt>=0) def.focusPoint = def.focusAt;
									else def.focusPoint = 2;
								}
								else
								{//existing subscript element
									base.SetData(base.sup,sup);
									def.mml = base;
									def.focusPoint = base.sup;
									def.doNotInsert = true;
								}
							}
							else
							{
								mrow.InsertAt(0,math.mml);
								def.mml = MML.msubsup(mrow,null,sup);
								if(def.focusAt>=0) def.focusPoint = def.focusAt;
								else def.focusPoint = 2;
							}
						}
						else
						{
							def.mml = MML.msubsup(mrow,null,sup);
							def.focusPoint = 0;
						}
						return def;
					},
				msub : function(def)
					{
						var math, base, mrow = MML.mrow(), itemConsumed, sub = MML.mrow();
						if(def.toLeft)
						{
							if(def.consumeLeft)
							{
								math = def.toLeft.parent.produceLeftItem(def.toLeft);
								if(math && math.mml)
								{
									def.indx = math.index;
									def.parent = math.parent;
									itemConsumed = true;
								}
								else //Should never happen, but just in case...
								{
									def.indx = def.toLeft.getIndex()+1;
									def.parent = def.toLeft.parent;
								}
							}
							else
							{
								def.indx = def.toLeft.getIndex()+1;
								def.parent = def.toLeft.parent;
							}
						}
						else
						{
							def.indx = 0;
							def.parent = def.mRow;
						}
						if(itemConsumed)
						{
							if((math.mml.type == "msubsup"))
							{
								base = math.mml;
								if(base.data[base.sub])
								{//double subcript, refuse to do anything
									return null;
								}
								else
								{//existing subscript element
									base.SetData(base.sub,sub);
									def.mml = base;
									def.focusPoint = base.sub;
									def.doNotInsert = true;
								}
							}
							else
							{
								mrow.InsertAt(0,math.mml);
								def.mml = MML.msubsup(mrow,sub,null);
								if(def.focusAt>=0) def.focusPoint = def.focusAt;
								else def.focusPoint = 1;
							}
						}
						else
						{
							def.mml = MML.msubsup(mrow,sub,null);
							def.focusPoint = 0;
						}
						return def;
					}
			},
			
		checkSpan	: function (span)
			{
				var iterator = span;
				while (iterator) 
				{
					if ((iterator.id)&&(iterator.id.indexOf("MathJax-Span-")> -1)) break;
					iterator = iterator.parentNode;
				}
				return iterator;
			},
		
		locateCorrespondingMML : function (span, root,side) //searches the MML tree until it finds an MML element that correspond to the given span
			{
				var spanID = Number(span.id.replace("MathJax-Span-","")),
					iterator = root, stack=[iterator],item;
					
				if ((iterator)&&(iterator.spanID) && (iterator.spanID==spanID)) return iterator;
				while (stack.length>0)
				{
					iterator = stack.pop();
					
					if(iterator && iterator.locateMMLhelper)
					{
						item = iterator.locateMMLhelper(spanID,stack,side);
						if (item!=null) return item;
					}
					else if(iterator&&iterator.data)
					{
						for (var i=0, m=iterator.data.length;i<m;i++)
						{
							item = iterator.data[i];
				
							if (item && (item.spanID) && (item.spanID==spanID))
							{
								return item;
							}
							else
							{
								stack.push(item);
							}
						}
					}
				}
				return null;
			},
	};
	
	MathJax.Hub.Register.StartupHook("onLoad",CALLBACK(ED.Config));
	
	AJAX.Require(ED.directory+"editor.css");
})(MathJax.Hub,MathJax.HTML,MathJax.Ajax,MathJax.Callback);

MathJax.Hub.Register.StartupHook("TeX Jax Ready",function () {
  
  var ED  = MathJax.Extension.Editor,
      MML = MathJax.ElementJax.mml,
      TEX = MathJax.InputJax.TeX,
      HUB = MathJax.Hub;

  var TEXDEF = TEX.Definitions,
      STACKITEM = TEX.Stack.Item;
  
  TEXDEF.Add({
    macros: {
    	inputfield:	'InputField'
    }
  },null,true);

	var oldMmlData = STACKITEM.prototype.mmlData;//Overriden so that all TeX commands that take arguments produce mml elements with their children wrapped in mrow while inside \inputfield
	STACKITEM.Augment({
		mmlData : function (inferred,forceRow) 
		{
			if(this.env.inInputField)
			{
				return MML.mrow.apply(MML,this.data);
			}
			else
			{
				return oldMmlData.apply(this,arguments);
			}
		}
	});
						
	var oldOpenCheckItem = STACKITEM.open.prototype.checkItem;//Override so that TeXAtom is replaced with mrow while inside the \inputfield
	STACKITEM.open.Augment({
		checkItem: function (item) 
		{
			if(this.env.inInputField)
			{
				if (item.type === "close") 
				{
					var mml = this.mmlData(); // mmlData is ovverriden to always return an mrow
					return STACKITEM.mml(mml); // remove TeXAtom as it is not necessary and screws things up.
				}
				return this.SUPER(arguments).checkItem.call(this,item);
			}
			else
			{
				return oldOpenCheckItem.apply(this,arguments);
			}
		}
	});
	
	var oldLeftCheckItem = STACKITEM.left.prototype.checkItem;//Override so that \left and \right always wrapp their data into an mRow
	STACKITEM.left.Augment({
		checkItem: function (item) {
			if(this.env.inInputField)
			{
				if (item.type === "right") {
					var mml = MML.mfenced(MML.mrow.apply(MML,this.data));
					return STACKITEM.mml(mml.With({open: this.delim, close: item.delim}));
				}
				return this.SUPER(arguments).checkItem.call(this,item);
			}
			else
			{
				return oldLeftCheckItem.apply(this,arguments);
			}
		}
	});

	var oldSubsupCheckItem = STACKITEM.subsup.prototype.checkItem;//Override so that children are added wrapped in mrow while inside \inputfield
	STACKITEM.subsup.Augment({
		checkItem: function (item) 
		{
			if(this.env.inInputField)
			{
				var script = ["","subscript","superscript"][this.position];
				if (item.type === "open" || item.type === "left") {return true}
				if (item.type === "mml") 
				{
					if((item.data[0].isa(MML.mrow))&&(!item.data[0].EDisContainer))
					{
						this.data[0].SetData(this.position,item.data[0]);
					}
					else
					{
						this.data[0].SetData(this.position,MML.mrow(item.data[0]));
					}
					return STACKITEM.mml(this.data[0]);
				}
				if (this.SUPER(arguments).checkItem.call(this,item))
				{TEX.Error("Missing open brace for "+script)}
			}
			else
			{
				return oldSubsupCheckItem.apply(this,arguments);
			}
		}
	});

	var oldFnCheckItem = STACKITEM.fn.prototype.checkItem; //Override so that "function application" entity item is not added while inside \inputfield
	STACKITEM.fn.Augment({
		checkItem: function (item) 
		{
			if(this.env.inInputField)
			{
				if (this.data[0]) 
				{
					if (item.type !== "mml" || !item.data[0]) {return [this.data[0],item]}
					if (item.data[0].isa(MML.mspace)) {return [this.data[0],item]}
					var mml = item.data[0]; if (mml.isEmbellished()) {mml = mml.CoreMO()}
					if ([0,0,1,1,0,1,1,0,0,0][mml.Get("texClass")]) {return [this.data[0],item]}
					return [this.data[0],item];
				}
				return this.SUPER(arguments).checkItem.apply(this,arguments);
			}
			else
			{
				return oldFnCheckItem.apply(this,arguments);
			}
		}
	});
	
	TEX.Parse.Augment({
/*	mmlToken : function () {return arguments},*/
    InputField:	function(name)
				{
					//We want every complex element to create an mrow and numbers and function names be sequences of symbols
					//It is easier to augment TeX.Parse object and revert the changes at the end of processing the arguments of \inputfield
					//than to implement the same via stack because mml elemtnts don't get to see the stack.env
					var ParseAugmentData = ["Superscript","Subscript","Number","NamedFn"],ParseOld = {},
						fieldList, fieldObj;
					
					if (!ED.fieldList) {ED.fieldList = fieldList = []} else {fieldList = ED.fieldList}
					
					if (this.stack.env.inInputField) {TEX.Error("Nested \\inputfield invocation.")};
					//else {fieldEntry = {processing : true}; fieldList.push(fieldEntry)}
					
					for(var i=0, m=ParseAugmentData.length;i<m;i++)//Save the old definitions of TeX.Parse object
					{
						ParseOld[ParseAugmentData[i]] = TEX.Parse.prototype[ParseAugmentData[i]];
					}
					
					TEX.Parse.Augment({
							Superscript: function (c) 
								{
									if (this.GetNext().match(/\d/)) // don't treat numbers as a unit
									{
										this.string = this.string.substr(0,this.i+1)+" "+this.string.substr(this.i+1)
									}
									var position, base = this.stack.Prev();
									if (!base) {base = MML.mrow(MML.mi(""))}
									if (base.isEmbellishedWrapper) {base = base.data[0].data[0]}
									if (base.type === "msubsup") 
									{
										if (base.data[base.sup]) 
										{
											if (!base.data[base.sup].isPrime) {TEX.Error("Double exponent: use braces to clarify")}
											base = MML.msubsup(MML.mrow(base),null,null);
										}
										position = base.sup;
									} 
									else if (base.movesupsub) 
									{
										if (base.type !== "munderover" || base.data[base.over]) 
										{
											if (base.movablelimits && base.isa(MML.mi)) {base = MML.mrow(this.mi2mo(base))}
											if((base.isa(MML.mrow))&&(!base.EDisContainer))
											{
												base = MML.munderover(base,null,null).With({movesupsub:true})
											}
											else
											{
												base = MML.munderover(MML.mrow(base),null,null).With({movesupsub:true})
											}
										}
										position = base.over;
									} 
									else 
									{
										if((base.isa(MML.mrow))&&(!base.EDisContainer))
										{
											base = MML.msubsup(base,null,null);
										}
										else
										{
											base = MML.msubsup(MML.mrow(base),null,null);
										}
										position = base.sup;
										
									}
									this.Push(STACKITEM.subsup(base).With({position: position}));
								},
							Subscript: function (c) 
								{
									if (this.GetNext().match(/\d/)) // don't treat numbers as a unit
									{this.string = this.string.substr(0,this.i+1)+" "+this.string.substr(this.i+1)}
									var position, base = this.stack.Prev(); if (!base) {base = MML.mi("")}
									if (base.isEmbellishedWrapper) {base = base.data[0].data[0]}
									if (base.type === "msubsup") 
									{
										if (base.data[base.sub]) {TEX.Error("Double subscripts: use braces to clarify")}
										position = base.sub;
									} 
									else if (base.movesupsub) 
									{
										if (base.type !== "munderover" || base.data[base.under]) 
										{
											if (base.movablelimits && base.isa(MML.mi)) {base = MML.mrow(this.mi2mo(base))}
											
											if((base.isa(MML.mrow))&&(!base.EDisContainer))
											{
												base = MML.munderover(base,null,null).With({movesupsub:true})
											}
											else
											{
												base = MML.munderover(MML.mrow(base),null,null).With({movesupsub:true})
											}
										}
										position = base.under;
									} 
									else 
									{
										if((base.isa(MML.mrow))&&(!base.EDisContainer))
										{
											base = MML.msubsup(base,null,null);
										}
										else
										{
											base = MML.msubsup(MML.mrow(base),null,null);
										}
										position = base.sub;
									}
									this.Push(STACKITEM.subsup(base).With({position: position}));
								},
							NamedFn: function (name,id) 
								{
									if (!id) {id = name.substr(1)};
									var mml = MML.functionrow().With({fName:id});
									for (i=0,m=id.length;i<m;i++) {mml.Append(this.mmlToken(MML.mi(id.charAt(i))));}
									this.Push(STACKITEM.fn(mml));
								},
							Number: function (c) 
								{
									var mnrow = MML.numberrow(), mml, n = this.string.slice(this.i-1).match(TEXDEF.number);
									if (n) 
									{
										mml = [];
										n=n[0].replace(/[{}]/g,"");
										for (var i=0, m=n.length;i<m;i++)
										{
											mml.push(MML.mn(n[i]));
										}
										this.i += n.length - 1
									}
									else {mml = MML.mo(MML.chars(c))}
									if (this.stack.env.font) {mml.mathvariant = this.stack.env.font}
									
									if(mml instanceof Array)
									{
										for (var i=0, m= mml.length;i<m;i++) {mnrow.Append(this.mmlToken(mml[i]));}
										
									}
									else mnrow.Append(this.mmlToken(mml));
									
									this.Push(mnrow);
								}
						});
					
					this.stack.env.inInputField = true;
					var params = this.GetBrackets(name,""),
						math = this.ParseArg(name,{inInputField : true});
					// return to original TEX.Parse
					TEX.Parse.Augment(ParseOld);
					
					var i=0,j ,parens=0, styleStrings = params.split('style');
					
					params = styleStrings.shift(); /* We process everything before the first appearance of 'style' later*/
/*					for (var string in styleStrings)
					{
						i=0;
						
						while (i < string.length) 
						{
							switch (params.charAt(this.i++)) 
							{
								case '{':   parens++; if (j == undefined) {j=i} break;
								case '\\':  i++; break;
								case '}':
								if (parens-- <= 0) {TEX.Error("Extra close brace while looking for ']' inside \\inputfield parameters")}
								if (parens == 0) {}
								break;   
								case ']':
								if (parens == 0) {return string.slice(j,i-1)}
								break;
							}
						}
					}
*/
						
					var parts = params.split(/,/), def = {EDisInputField : true, extraAttributes : {EDisInputField : 1}},
						fieldName,fieldId;
					
					for (var i = 0, m = parts.length, part = parts[0]; i < m; i++, part=parts[i])
					{
						var keys = part.split(/=/);
						switch(keys[0])
						{
							case 'id' :
								fieldName = keys[1];
								if (!def.extraAttributes) {def.extraAttributes = {};}
								HUB.Insert(def.extraAttributes, {fieldId : fieldName});
								break;
						}
					}
					
					if (!def.extraAttributes) {def.extraAttributes = {};} def.extraAttributes.EDisInputField=1;
/*					if((math.isa(MML.mbase))&&(math.data)&&(math.data.length>0))
					{
						if((math.isa(MML.mrow))&&(!math.EDisContainer))
						{
							delete (math.inferred);
							math=math.With(def);
						}
						else
						{
							math = MML.mrow(math).With(def);
						}
					}
					else
					{
						def.emptyMRow = true;
						def.extraAttributes.emptyMRow = true;
						math = MML.mrow(MML.mphantom("X")).With(def);
					}*/
					
					fieldId = fieldList.length;
					if(fieldName == undefined) fieldName = fieldId.toString();
					def.fieldName = fieldName;
					def.fieldId = fieldId;

					if((math.isa(MML.mrow))&&(!math.EDisContainer))
					{
						delete (math.inferred);
						math=math.With(def);
					}
					else
					{
						math = MML.mrow(math).With(def);
					}
					
					fieldObj = {mml:math,id:fieldId,name:fieldName};
					fieldList.push(fieldObj);
					delete this.stack.env.inInputField;
					this.Push(math);
				}
  });
  
  MathJax.Hub.Startup.signal.Post("MathJax Editor Ready");
  
});

MathJax.Hub.Register.StartupHook(MathJax.Extension.Editor.config.OutputJax + " Jax Startup",function (){
	var MML = MathJax.ElementJax.mml,
		ED  = MathJax.Extension.Editor,
		JAX = MathJax.OutputJax[ED.config.OutputJax],
		HUB = MathJax.Hub;
		
	MML.mbase.Augment({
		EDisAtomic : true,
			
		EDcheckHighlighted : function ()
			{
				var parent = this;
				
				while (parent)
				{
					if(parent.EDisInputField)
					{
						return false
					}
					else
					{
						if(parent.EDisHighlighted) return true;
					}
					parent = parent.parent;
				}
				return false;
			},
		
		/********* MML tree traversal code ********************************************************/
		
		findParentMRow : function ()
			{
				var parent = this;
				
				while (parent)
				{
					if ((!parent.EDisContainer)&&(parent.type == "mrow"))
					{
						return parent;
					}
					if (parent.type == "math") return null;
					
					parent = parent.parent;
				}
				return null;
			},
		
		getChildIndexes : function () //Returns array of indexes of children, if it can locate ones.
			{
				var indexes = null;
				
				if (arguments.length>0)
				{
					var item, index;
					
					indexes = [];
					
					if (this.data&&(this.data.length>0))
					{
						for(var i = 0, n=arguments.length;i<n;i++)
						{
							item = arguments[i];
							index = -1;
							if(item)
							{
								for (var j=0,m=this.data.length;j<m;j++)
								{
									if (item == this.data[j])
									{
										index = j;
										break;
									}
								}
							}
							indexes.push(index);
						}
					}
				}
				return indexes;
			},

		produceLeftItem : function(item) //This function returns a child element that should be consumed by a template that is about to be put in. Since this may involve some substantial changes in the mml structure of the "this" object we return a structure.
			{
				if (item.parent == this)
				{
					return {mml:item,index:item.getIndex(),parent:this};
				}
				else
					return item.parent.produceLeftItem(item);
			},
			
		getIndex : function ()
			{
				var parent = this.parent;
				
				if (parent)
				{
					for(var i =0, m = parent.data.length; i<m;i++)
					{
						if (parent.data[i]==this)
						{
							return i;
						}
					}
				}
				
				return null;
			},
			
		getNext : function ()
			{
				var parent = this.parent;
				
				if (parent)
				{
					for(var i =0, m = parent.data.length; i<m;i++)
					{
						if (parent.data[i]==this)
						{
							if (i<m-1) return parent.data[i+1];
							break;
						}
					}
				}
				
				return null;
			},
		
		getPrevious : function ()
			{
				var parent = this.parent;
				
				if (parent)
				{
					for(var i =0, m = parent.data.length; i<m;i++)
					{
						if (parent.data[i]==this)
						{
							if (i>0) return parent.data[i-1];
							break;
						}
					}
				}
				
				return null;
			},
		
		/********* Focusing Code for navigation and clicks ****************************************/
		
		focusOutToLeftFromChild : function (child,def)
			{
				var prev = child.getPrevious();
				
				if (prev)
				{
					return prev.focusRightToLeft(this,def)
				}
				else
				{
					prev = this.getPrevious();
					if(prev)
					{
						def.toRight = this;
						return prev.focusInFromRight(this,def);
					}
					else
					{
						def.toLeft = null;
						return this.focusInFromLeft(this,def);
					}
/*					prev = this.parent;
					if (prev) {def = prev.focusOutToLeftFromChild(this,def);prev = (def.toLeft)?def.toLeft:def.toRight;def.mRow = prev.findParentMRow();}*/
				}
				
				return def
			},
		
		focusOutToRightFromChild : function (child,def)
			{
				var next = child.getNext();
				
				if (next)
				{
					return next.focusLeftToRight(this,def);
				}
				else
				{
					next = this.getNext();
					if(next)
					{
						def.toLeft = this;
						return next.focusInFromLeft(this,def);
					}
					else
					{
						def.toRight = null;
						return this.focusInFromRight(this,def);
					}
/*					next = this.parent;
					if (next) {def = next.focusOutToRightFromChild(this,def);next = (def.toLeft)?def.toLeft:def.toRight;def.mRow = next.findParentMRow();}*/
				}
				
				return def
			},
		
		focusInFromLeft : function (item, def)
			{
				if(this.EDProperties&&this.EDProperties.ghostElement)
				{
					return this.focusLeftToRight(item,def);
				}
				else
				{
					var add = {
									toRight	: this,
									mRow : this.findParentMRow(),
									insertAt : this.getIndex(),
									clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
									clickSide : -1
								};
					for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
					return def
				}
			},
		
		focusInFromRight : function (item, def)
			{
				if(this.EDProperties&&this.EDProperties.ghostElement)
				{
					return this.focusRightToLeft(item,def);
				}
				else
				{
					var add = {
									toLeft	: this,
									mRow : this.findParentMRow(),
									insertAt : this.getIndex()+1,
									clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
									clickSide : 1
								};
					for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
					return def
				}
			},
		
		focusOutToRight : function (item, def)
			{
				var next = this.getNext();
				
				if (next)
				{
					return next.focusLeftToRight(this,def);
				}
				else
				{
					next = this.parent;
					
					if (next) return next.focusOutToRightFromChild(this,def);
					else return def;
				}
			},
		
		focusOutToLeft : function (item, def)
			{
				var prev = this.getPrevious();
				
				if (prev)
				{
					return prev.focusRightToLeft(this,def)
				}
				else
				{
					prev = this.parent;
					
					if (prev) return prev.focusOutToLeftFromChild(this,def);
					else return def;
				}
			},
		
		focusLeftToRight : function (item, def)
			{
				var next = this.getNext();
				
				if (next)
				{
					def.toLeft = this;
					return next.focusInFromLeft(this,def);
				}
				else
				{
					var add = {
									toRight	: null,
									toLeft	: this,
									insertAt : this.getIndex()+1,
									clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
									clickSide : 1
								};
					for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
					return def
				}
			},
		focusRightToLeft : function (item, def)
			{
				var prev = this.getPrevious();
				
				if (prev)
				{
					def.toRight = this;
					return prev.focusInFromRight(this,def)
				}
				else
				{
					var add = {
									toRight	: this,
									toLeft	: null,
									insertAt : this.getIndex(),
									clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
									clickSide : -1
								};
					for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
					return def
				}
			},
		
		/********* Editing Code *******************************************************************/
		InsertAt : function (at,math,def) //Insert the content of the "math" object into the data list of the "this" mml object
			{
				if(math!=null)
				{
					if(math instanceof Array)
					{
						var item,tempdata = [];
						for(var i =0, m = math.length;i<m;i++)
						{
							item = math[0];
							if(item.parent)
							{
								item.parent.RemoveAt(item.getIndex());
							}
							if ((i<(m-1))&&item == math[0])
							{
								math.splice(0,1);
							}
							if(!(item instanceof MML.mbase))
							{
								tempdata[i] = ((this.isToken)?(MML.chars(item)):(MML.mtext(item)));
							}
							else
							{
								tempdata[i] = item;
							}
							item.parent = this;
							item.setInherit(this.inheritFromMe ? this : this.inherit);
						}
						if(!def)
						{
							def = {};
						}
						def.toLeft = tempdata[tempdata.length -1];
						if(this.emptyMRow)
						{
							this.data = tempdata;
							this.emptyMRow = false;
							delete this.extraAttributes.emptymrow;
						}
						else if(this.data&&this.data.length)
						{
							this.data.splice.apply(this.data,[at,0].concat(tempdata));
						}
						else
						{
							this.data = tempdata;
						}
					}
					else
					{
						if(math.parent)
						{
							math.parent.RemoveAt(math.getIndex());
						}
						if(!(math instanceof MML.mbase))
						{
							math = ((this.isToken)?(MML.chars(math)):(MML.mtext(math)));
						}
						math.parent = this;
						math.setInherit(this.inheritFromMe ? this : this.inherit);
						if(!def)
						{
							def = {};
						}
						def.toLeft = math;
						if(this.emptyMRow)
						{
							this.data = [math];
							this.emptyMRow = false;
							delete this.extraAttributes.emptymrow;
						}
						else if(this.data&&this.data.length)
						{
							this.data.splice(at,0,math);
						}
						else
						{
							this.data = [math];
						}
					}
				}
				return def;
			},
			
		DeleteFromRight : function(def)
			{
				return this.Vanish(def);
			},
			
		DeleteFromLeft : function(def)
			{
				return this.Vanish(def);
			},
			
		RemoveAt : function (at,def)
			{
				if(!def)
				{
					def = {};
				}
				if(this.data&&this.data.length)
				{
					this.data.splice(at,1);
					if(at>0)
					{
						def.toLeft = this.data[at-1];
						def = def.toLeft.focusInFromRight(def.toLeft,def);
						if (!(def.toRight))
						{
							def.toRight = def.toLeft.getNext();
						}
					}
					else if(this.data.length>0)
					{
						def.toLeft = null;
						def.toRight = this.data[0];
						def = def.toRight.focusInFromLeft(def.toRight,def);
					}
					else
					{
						def = this.LastOneRemoved(def);
					}
					return def;
				}
				else
				{
					//TODO: throw an error message. This is not supposed to happen anyway
					return null
				}
			},
		
		LastOneRemoved : function (def)
			{
				if (!def)
				{
					def = {};
				}
				return this.Vanish(def);
			},
			
		Vanish : function(def)
			{
				var indx = this.getIndex();
				if (!def)
				{
					def = {};
				}
				
				if(indx>=0)
				{
					return this.parent.RemoveAt(indx,def);
				}
				else return {};
			},
			
		checkSyntax : function()//This function should check if this mml object needs to adjust itself because of changed content around and inside it.
			{
				return;
			}
	});
	
	MML.mrow.Augment({
		isEmptyMRow : function ()
			{
				if (this.emptyMRow/*this.data && (this.data.length>0)*/) return true;
				return false;
			},

		Init : function () 
			{
				this.data = [];
				if (arguments.length >0)
				{this.Append.apply(this,arguments);}
				else
				{	// This mRow is empty. If nothing is done, it will not be rendered. The hack is to add a bogus mText element.
					if((!this.EDisContainer))
					{
						this.SetData(0, MML.mtext(ED.config.nbsp));
						this.emptyMRow = true;
						this.extraAttributes = {emptymrow : true};
					}
				}
			},
			
		Append : function ()
			{
				if ((this.emptyMRow)&&(arguments.length > 0))
				{
					delete this.emptyMRow;
					delete this.extraAttributes.emptymrow;
					
					this.data.splice(0,1);
				}
				if (this.inferRow && this.data.length) {
				this.data[0].Append.apply(this.data[0],arguments);
				} else {
				for (var i = 0, m = arguments.length; i < m; i++)
				{this.SetData(this.data.length,arguments[i])}
				}
			},
			
		EDisAtomic : false,
		
		/********* Focusing Code for navigation and clicks ****************************************/
		
		focusOutToLeftFromChild : function (child,def)
			{
				var prev = child.getPrevious();
				
				if (prev)
				{
					return prev.focusRightToLeft(this,def)
				}
				else
				{
					if (this.EDisInputField)
					{
					}
					else
					{
						prev = this.parent;
						if (prev) 
						{
							def = prev.focusOutToLeftFromChild(this,def);
							if(!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if(prev) def.mRow = prev.findParentMRow();}
						}
					}
				}
				
				return def
			},
		
		focusOutToRightFromChild : function (child,def)
			{
				var next = child.getNext();
				
				if (next)
				{
					return next.focusLeftToRight(this,def);
				}
				else
				{
					if (this.EDisInputField)
					{
					}
					else
					{
						next = this.parent;
						if (next) 
						{
							def = next.focusOutToRightFromChild(this,def);
							if(!def.mRow) {next = (def.toLeft)?def.toLeft:def.toRight;if(next) def.mRow = next.findParentMRow()};
						}
					}
				}
				
				return def
			},
		
		focusOutToRight : function (item, def)
			{
				if ((this.isEmptyMRow())&&(this.EDisInputField))
				{
					def={};
				}
				else
				{
					var next = this.parent;
					if (next) 
					{
						def = next.focusOutToRightFromChild(this,def);
						if(!def.mRow) {next = (def.toLeft)?def.toLeft:def.toRight;if(next) def.mRow = next.findParentMRow()};
					}
				}
				return def;
			},
		
		focusOutToLeft : function (item, def)
			{
				if ((this.isEmptyMRow())&&(this.EDisInputField))
				{
					def={};
				}
				else
				{
					var prev = this.parent;
					if (prev) 
					{
						def = prev.focusOutToLeftFromChild(this,def);
						if(!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if(prev) def.mRow = prev.findParentMRow();}
					}
				}
				return def;
			},
		
		focusInFromLeft : function (item, def)
			{
				if (this.isEmptyMRow())
				{
					def.toLeft = null;
					def.toRight = null;
					def.clickSide = 0;
					def.clickSpan = document.getElementById("MathJax-Span-"+this.spanID);
					def.mRow = this;
					
					return def;
				}
				if((this.data)&&(this.data.length>0))
				{
					def.toLeft=null;
					return this.data[0].focusInFromLeft(this,def);;
				}
				else return def
			},
		
		focusInFromRight : function (item, def)
			{
				if (this.isEmptyMRow())
				{
					def.toLeft = null;
					def.toRight = null;
					def.clickSide = 0;
					def.clickSpan = document.getElementById("MathJax-Span-"+this.spanID);
					def.mRow = this;
					
					return def;
				}
				if((this.data)&&(this.data.length>0))
				{
					def.toRight=null;
					return this.data[this.data.length-1].focusInFromRight(this,def);;
				}
				else return def
			},
		
		focusLeftToRight : function (item, def)
			{
				if (this.isEmptyMRow())
				{
					def.toLeft = null;
					def.toRight = null;
					def.clickSide = 0;
					def.mRow = this;
					
					return def;
				}
				if((this.data)&&(this.data.length>0))
				{
					def.toLeft=null;
					return this.data[0].focusInFromLeft(this,def);
				}
				else 
				{
					var next = this.getNext();
				
					if (next)
					{
						def.toLeft = this;
						return next.focusInFromLeft(this,def);
					}
					else
					{
						var add = {
										toRight	: null,
										toLeft	: this,
										insertAt : this.getIndex()+1,
										clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
										clickSide : 1
									};
						for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
						return def
					}
				}
			},
			
		focusRightToLeft : function (item, def)
			{
				if (this.isEmptyMRow())
				{
					def.toLeft = null;
					def.toRight = null;
					def.clickSide = 0;
					def.mRow = this;
					
					return def;
				}
				if((this.data)&&(this.data.length>0))
				{
					def.toRight=null;
					return this.data[this.data.length - 1].focusInFromRight(this,def);
				}
				else 
				{
					var prev = this.getPrevious();
				
					if (prev)
					{
						def.toRight = this;
						return prev.focusInFromRight(this,def)
					}
					else
					{
						var add = {
										toRight	: this,
										toLeft	: null,
										insertAt : this.getIndex(),
										clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
										clickSide : -1
									};
						for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
						return def
					}
				}
			},
		/********* Editing Code **************************************************************************/

		removePlaceHolder : function (item,def)
			{
				return item.Vanish(def);
			},
			
		removeLeftNeighbor : function (item,def)
			{
				if(this.EDisInputField&&this.data&&(this.data[0] == item))
				{
				}
				else if(item&&item.parent == this)
				{
					var leftItem = item.getPrevious();
					if(leftItem)
					{
						return leftItem.DeleteFromRight(def)
					}
					else
					{
						if(this.parent.removeLeftNeighbor)
						{
							return this.parent.removeLeftNeighbor(this,def);
						}
					}
				}
				ED.Event.Beep();
				return {};
			},
			
		removeRightNeighbor : function (item,def)
			{
				if(this.EDisInputField&&this.data&&(this.data[this.data.length-1] == item))
				{
				}
				else if(item&&item.parent == this)
				{
					var rightItem = item.getNext();
					if(rightItem)
					{
						return rightItem.DeleteFromRight(def)
					}
					else
					{
						if(this.parent.removeRightNeighbor)
						{
							return this.parent.removeRightNeighbor(this,def);
						}
					}
				}
				ED.Event.Beep();
				return {};
			},
			
		DeleteFromRight : function(def)
			{
				if(this.emptyMRow)
				{
					//TODO signal the parent that mRow is about to be deleted 
					return this.parent.removePlaceHolder(this,def);
				}
				else if(this.data&&this.data.length>0)
				{
					return this.data[this.data.length -1].DeleteFromRight(def);
				}
				return this.Vanish(def);
			},
			
		DeleteFromLeft : function(def)
			{
				if(this.emptyMRow)
				{
					//TODO signal the parent that mRow is about to be deleted 
					return this.parent.removePlaceHolder(this,def);
				}
				else if(this.data&&this.data.length>0)
				{
					return this.data[0].DeleteFromLeft(def);
				}
				return this.Vanish(def);
			},
			
		LastOneRemoved : function (def) //The regular mRow should just indicate that it becomes empty. To make it visible, the "empty mRow hack" is used.
			{
				if(!def)
				{
					def = {};
				}
				if(!this.EDisContainer)
				{
					this.SetData(0, MML.mtext(ED.config.nbsp));
					this.emptyMRow = true;
					if(this.extraAttributes)
					{
						this.extraAttributes.emptymrow = true;
					}
					else
					{
						this.extraAttributes = {emptymrow : true};
					}
					return this.focusInFromLeft(this,def);
				}
				else
				{
					return this.Vanish(def);
				}
			},
			
		
		/********* HTML Generation Code *******************************************************************/

		toHTML: function (span) {
				span = this.HTMLcreateSpan(span); 
				for (var i = 0, m = this.data.length; i < m; i++)
				  {if (this.data[i]) {this.data[i].toHTML(span)}}
				var stretchy = this.HTMLcomputeBBox(span);
				var h = span.bbox.h, d = span.bbox.d;
				for (i = 0, m = stretchy.length; i < m; i++) {stretchy[i].HTMLstretchV(span,h,d)}
				if (stretchy.length) {this.HTMLcomputeBBox(span,true)}
					if (this.HTMLlineBreaks(span)) {span = this.HTMLmultiline(span)}
				this.HTMLhandleSpace(span);
				this.HTMLhandleColor(span);
				if (this.extraAttributes)
				{
					this.HTMLAppendAttributes(span);
				}
				if (this.EDisInputField)
				{
					this.HTMLAttachEventListeners(span);
					span.EDisInputField=true;
				}
				return span;
			},
		HTMLAppendAttributes : function(span)
			{
			/*	var node;*/
				for (var id in this.extraAttributes)
				{
					if (this.extraAttributes.hasOwnProperty(id))
					{
/*						node = document.createAttribute(String(id));
						
						node.value = String(this.extraAttributes[id]);
						span.setAttributeNode(node);*/
						span.setAttribute(String(id),String(this.extraAttributes[id]));
					}
				}
			},
		HTMLAttachEventListeners : function(span)
			{// Every \inputfield should listen to mouse events.
				span.addEventListener('click',ED.Event.Click,true);
				span.addEventListener("mousedown",ED.Event.Mousedown,true);
				span.addEventListener("mouseup",ED.Event.Mouseup,true);
				span.addEventListener("mousemove",ED.Event.Mousemove,true);
				
				if ((this.extraAttributes)&&(this.extraAttributes.selected==true))
				{//If the \inputfield is selected, it must listen to the keys
					document.addEventListener('keydown',ED.Event.Keydown,true);
				//	document.addEventListener('keypress',processKeyPress,false);
					document.addEventListener('keypress',ED.Event.Keypress,true);
				}
			}
      });

	MML.numberrow = MML.mrow.Subclass(
		{
			focusOutToLeftFromChild : function (child,def)
				{
					var prev = child.getPrevious();
				
					if (prev)
					{
						return prev.focusRightToLeft(this,def)
					}
					else
					{
						prev = this.getPrevious();
						if(prev)
						{
							def.toRight = this;
							return prev.focusRightToLeft(this,def);
						}
						else
						{
							prev = this.parent;
							if (prev) 
							{
								def = prev.focusOutToLeftFromChild(this,def);
								if (!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight;if(prev) def.mRow = prev.findParentMRow();}
							}
						}
					}
				
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					var next = child.getNext();
				
					if (next)
					{
						return next.focusLeftToRight(this,def);
					}
					else
					{
						next = this.getNext();
						if(next)
						{
							def.toLeft = this;
							return next.focusLeftToRight(this,def);
						}
						else
						{
							next = this.parent;
							if (next) 
							{
								def = next.focusOutToRightFromChild(this,def);
								if (!def.mRow) {next = (def.toLeft)?def.toLeft:def.toRight;if(next) def.mRow = next.findParentMRow();}
							}
						}
					}
				
					return def
				},
			
			focusLeftToRight : function (item, def)
				{
					if((this.data)&&(this.data.length>0))
					{
						return this.data[0].focusLeftToRight(this,def);
					}
					else 
					{
						var next = this.getNext();
				
						if (next)
						{
							def.toLeft = this;
							return next.focusInFromLeft(this,def);
						}
						else
						{
							var add = {
											toRight	: null,
											toLeft	: this,
											insertAt : this.getIndex()+1,
											clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
											clickSide : 1
										};
							for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
							return def
						}
					}
				},
			
			focusRightToLeft : function (item, def)
				{
					if((this.data)&&(this.data.length>0))
					{
						return this.data[this.data.length - 1].focusRightToLeft(this,def);
					}
					else 
					{
						var prev = this.getPrevious();
				
						if (prev)
						{
							def.toRight = this;
							return prev.focusInFromRight(this,def)
						}
						else
						{
							var add = {
											toRight	: this,
											toLeft	: null,
											insertAt : this.getIndex(),
											clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
											clickSide : -1
										};
							for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
							return def
						}
					}
				},
		/********* Editing Code **************************************************************************/

			removePlaceHolder : function (item,def)
				{
					return item.Vanish(def);
				},
			
			InsertAt : function(at,math,def)
				{
					if(math!=null)
					{
						if(math instanceof Array)
						{
							var item,tempdata = [],m = math.length;
							for(var i =0;i<m;i++)
							{
								item = math[0];
								if(item.parent)
								{
									item.parent.RemoveAt(item.getIndex());
								}
								if ((i<(m-1))&&item == math[0])
								{
									math.splice(0,1);
								}
								if(!(item instanceof MML.mbase))
								{
									this.InsertAt(at,(this.isToken)?(MML.chars(item)):(MML.mtext(item)),def);
								}
								else
								{
									this.InsertAt(at,item,def);
								}
							}
							def = item.focusInFromRight(item,def);
						}
						else
						{
							if(math.parent)
							{
								math.parent.RemoveAt(math.getIndex());
							}
							if(!(math instanceof MML.mn))
							{
								if(at>0)
								{
									if(at<this.data.length)
									{
										this.split(at-1);
										return this.parent.InsertAt(this.getIndex()+1,math,def);
									}
									else
										return this.parent.InsertAt(this.getIndex()+1,math,def);
								}
								else
									return this.parent.InsertAt(this.getIndex(),math,def);
							}
							else return this.InsertAt.SUPER.InsertAt.call(this,at,math,def);
						}
					}
					return def;
				},
			
			split : function(at)
				{
					if(this.data&&at>=0&&at<this.data.length-1)
					{
						var items=this.data.splice(at+1,this.data.length-at-1), mnrow = MML.numberrow();

						mnrow.Append.apply(mnrow,items);
						this.parent.InsertAt(this.getIndex()+1,mnrow);
						return [this,mnrow];
					}
					else if(at == -1)
					{
						return [null,this];
					}
					else if(at == this.data.length -1)
					{
						return [this,null];
					}
					return [null,null]
				},

			produceLeftItem : function(item)
				{
					if(item.parent == this)
					{
						var i,m=this.data.length,containers,mml;
						for (i=0;i<m;i++) {if (item == this.data[i]) break;}
						containers = this.split(i);
						return {mml:containers[0],index:this.getIndex(),parent:this.parent};
					}
					else 
						return item.parent.produceLeftItem(item);
				},

			EDisContainer	: "mn",
			numberString	: "",
			extraAttributes	: {container : "mn"}
		});
	
	MML.functionrow = MML.mrow.Subclass(
		{
			focusOutToLeftFromChild : function (child,def)
				{
					var prev = child.getPrevious();
				
					if (prev)
					{
						return prev.focusRightToLeft(this,def)
					}
					else
					{
						prev = this.getPrevious();
						if(prev)
						{
							def.toRight = this;
							return prev.focusRightToLeft(this,def);
						}
						else
						{
							prev = this.parent;
							if (prev) 
							{
								def = prev.focusOutToLeftFromChild(this,def);
								if (!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight;if(prev) def.mRow = prev.findParentMRow();}
							}
						}
					}
				
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					var next = child.getNext();
				
					if (next)
					{
						return next.focusLeftToRight(this,def);
					}
					else
					{
						next = this.getNext();
						if(next)
						{
							def.toLeft = this;
							return next.focusLeftToRight(this,def);
						}
						else
						{
							next = this.parent;
							if (next) 
							{
								def = next.focusOutToRightFromChild(this,def);
								if (!def.mRow) {next = (def.toLeft)?def.toLeft:def.toRight;if(next) def.mRow = next.findParentMRow();}
							}
						}
					}
				
					return def
				},
		
			focusLeftToRight : function (item, def)
				{
					if((this.data)&&(this.data.length>0))
					{
						return this.data[0].focusLeftToRight(this,def);
					}
					else 
					{
						var next = this.getNext();
				
						if (next)
						{
							def.toLeft = this;
							return next.focusInFromLeft(this,def);
						}
						else
						{
							var add = {
											toRight	: null,
											toLeft	: this,
											insertAt : this.getIndex()+1,
											clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
											clickSide : 1
										};
							for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
							return def
						}
					}
				},
			
			focusRightToLeft : function (item, def)
				{
					if((this.data)&&(this.data.length>0))
					{
						return this.data[this.data.length - 1].focusRightToLeft(this,def);
					}
					else 
					{
						var prev = this.getPrevious();
				
						if (prev)
						{
							def.toRight = this;
							return prev.focusInFromRight(this,def)
						}
						else
						{
							var add = {
											toRight	: this,
											toLeft	: null,
											insertAt : this.getIndex(),
											clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
											clickSide : -1
										};
							for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
							return def
						}
					}
				},
			Append: function () {//this function is overriden so that the letters will be automatically added with the MML.VARIANT.NORMAL style
				for (var i = 0, m = arguments.length; i < m; i++)
				  {this.SetData(this.data.length,arguments[i].With(this.defaults))}
			},
			
			split : function(at)
				{
					if(this.data&&at>=0&&at<this.data.length-1)
					{
						var items=this.data.splice(at+1,this.data.length-at-1), mnrow = MML.numberrow();

						mnrow.Append.apply(mnrow,items);
						this.parent.InsertAt(this.getIndex()+1,mnrow);
						return [this,mnrow];
					}
					else if(at == -1)
					{
						return [null,this];
					}
					else if(at == this.data.length -1)
					{
						return [this,null];
					}
					return [null,null]
				},

			produceLeftItem : function(item)
				{
					if(item.parent == this)
					{
						var i,m=this.data.length,containers,mml;
						for (i=0;i<m;i++) {if (item == this.data[i]) break;}
						containers = this.split(i);
						return {mml:containers[0],index:this.getIndex(),parent:this.parent};
					}
					else 
						return item.parent.produceLeftItem(item);
				},

			texClass: MML.TEXCLASS.ORD,
			fName	: "",
			defaults: 
				{
					mathvariant: MML.VARIANT.NORMAL,
				},
			EDisContainer : "fn",
			extraAttributes : {container : "fn"}
		});
	
	MML.mfrac.Augment(
		{
			focusOutToLeftFromChild : function (child,def)
				{
					if (child == this.data[this.den])
					{
						return this.data[this.num].focusRightToLeft(this,def)
					}
					else
					{
						var prev = this.getPrevious();
						if(prev)
						{
							def.toRight = this;
							return prev.focusInFromRight(this,def);
						}
						else
						{
							def.toLeft = null;
							return this.focusInFromLeft(this,def);
						}
					}
				
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					if (child == this.data[this.num])
					{
						return this.data[this.den].focusLeftToRight(this,def)
					}
					else
					{
						var next = this.getNext();
						if(next)
						{
							def.toLeft = this;
							return next.focusInFromLeft(this,def);
						}
						else
						{
							def.toRight = null;
							return this.focusInFromRight(this,def);
						}
					}
				
					return def
				},
		
			focusLeftToRight : function (item, def)
				{
					var next;
					def = this.data[this.num].focusLeftToRight(this,def);
					if (!def.mRow) {next = (def.toRight)?def.toRight:def.toLeft; if (next) def.mRow = next.findParentMRow();}
					return def;
				},
			focusRightToLeft : function (item, def)
				{
					var prev;
					def = this.data[this.den].focusRightToLeft(this,def);
					if (!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if (prev) def.mRow = prev.findParentMRow();}
					return def;
				},
		/********* Editing Code **************************************************************************/

			removePlaceHolder : function(item,def)
				{
					if(item == this.data[this.den])
					{
						if(!this.data[this.num].emptyMRow)
						{
							var indx = this.getIndex();
							
							def = this.parent.InsertAt(indx,this.data[this.num].data,def);
							
							return this.Vanish(def);
						}
						else
							return this.Vanish(def);
					}
					else if(item == this.data[this.num])
					{
						if(!this.data[this.den].emptyMRow)
						{
							var indx = this.getIndex();
							
							def = this.parent.InsertAt(indx+1,this.data[this.den].data,def);
							
							return this.Vanish(def);
						}
						else
							return this.Vanish(def);
					}
					else
						return def;
				},

			removeLeftNeighbor : function (item,def)
				{
					if(item&&item.parent == this&&item == this.data[this.den])
					{
						var indx = this.getIndex(),m=0;
						if(!this.data[this.num].emptyMRow)
						{//Spill all content of the numerator into the parent mRow
							m = this.data[this.num].data.length;
							def = this.parent.InsertAt(indx,this.data[this.num].data,def)
						}
						else
						{// Nothing gets spilled into the parent mRow
							if (indx>0) 
							{
								def = {toLeft: this.parent.data[indx-1],mRow : this.parent};
							}
							else
							{
								def = {toLeft:null,mRow:this.parent};
							}
						}
						if(!this.data[this.den].emptyMRow)
						{
							def.toRight = this.data[this.den].data[0];
							this.parent.InsertAt(indx+m,this.data[this.den].data);
						}
						else
						{
							def.toRight = this.getNext();
						}
						this.Vanish();
						if(def.toLeft)
						{
							def = def.toLeft.focusInFromRight(def.toLeft,def);
						}
						else if(def.toRight)
						{
							def = def.toRight.focusInFromLeft(def.toRight,def);
						}
						else
						{
							def.clickSide = 0;
						}
						return def;
					}
					else if(item&&item.parent == this&&item == this.data[this.num])
					{
						if(this.data[this.num].emptyMRow)
						{// remove the numerator placeholder and spill the content of the denominator into the parent mRow
							if(this.data[this.den].emptyMRow)
							{// the whole fraction is empty, just remove it.
								return this.Vanish(def);
							}
							else
							{
								var indx = this.getIndex();
								def.toRight = this.data[this.den].data[0];
								this.parent.InsertAt(indx+1,this.data[this.den].data);
								return this.Vanish(def);
							}
						}
						else
						{
							return this.parent.removeLeftNeighbor(this,def);
						}
					}
					ED.Event.Beep();
					return {};
				},
			
			DeleteFromRight : function(def)
				{
					if(this.data&&this.data.length>0)
					{
						return this.data[this.den].DeleteFromRight(def);
					}
					return this.Vanish(def);
				},
			
			DeleteFromLeft : function(def)
				{
					if(this.data&&this.data.length>0)
					{
						return this.data[this.num].DeleteFromLeft(def);
					}
					return this.Vanish(def);
				}
		});
	
	MML.msubsup.Augment(
		{
			focusOutToLeftFromChild : function (child,def)
				{
					if (child == this.data[this.sup])
					{
						if(this.data[this.sub])
						{
							return this.data[this.sub].focusRightToLeft(this,def)
						}
						else
						{
							return this.data[this.base].focusRightToLeft(this,def)
						}
					}
					else if (child == this.data[this.sub])
					{
						return this.data[this.base].focusRightToLeft(this,def)
					}
					else
					{
						var prev = this.getPrevious();
						if(prev)
						{
							def.toRight = this;
							return prev.focusInFromRight(this,def);
						}
						else
						{
							def.toLeft = null;
							return this.focusInFromLeft(this,def);
						}
					}
				
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					if (child == this.data[this.base])
					{
						if(this.data[this.sub])
						{
							return this.data[this.sub].focusLeftToRight(this,def)
						}
						else if(this.data[this.sup])
						{
							return this.data[this.sup].focusLeftToRight(this,def)
						}
					}
					else if (child == this.data[this.sub])
					{
						if(this.data[this.sup])
						{
							return this.data[this.sup].focusLeftToRight(this,def)
						}
					}
					var next = this.getNext();
					if(next)
					{
						def.toLeft = this;
						return next.focusInFromLeft(this,def);
					}
					else
					{
						def.toRight = null;
						return this.focusInFromRight(this,def);
					}
/*					next = this.parent;
					if (next) {def = next.focusOutToRightFromChild(this,def);next = (def.toLeft)?def.toLeft:def.toRight;def.mRow = next.findParentMRow();}*/
					return def
				},
		
			focusLeftToRight : function (item, def)
				{
					var next;
					def = this.data[this.base].focusLeftToRight(this,def);
					if (!def.mRow) {next = (def.toRight)?def.toRight:def.toLeft; if (next) def.mRow = next.findParentMRow();}
					return def;
				},
			focusRightToLeft : function (item, def)
				{
					var prev;
					if(this.data[this.sup]) prev = this.data[this.sup];
					else if(this.data[this.sub]) prev = this.data[this.sub];
					else prev = this.data[this.base];
					def =prev.focusRightToLeft(this,def);
					if (!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if (prev) def.mRow = prev.findParentMRow();}
					return def;
				},
		/********* Editing Code **************************************************************************/

			removePlaceHolder : function(item,def)
				{
					if(item == this.data[this.sup])
					{
						if(this.data[this.sub])
						{
							def = this.data[this.sub].focusInFromRight(this,def);
							this.data[this.sup]=null;
							return def;
						}
						else 
						{
							var mrow;
							if(this.data[0].EDProperties&&this.data[0].EDProperties.ghostElement) mrow = this.data[0].data[0];
							else mrow = this.data[0];
							def = this.parent.InsertAt(this.getIndex(),mrow.data,def);
							return this.Vanish(def);
						}
					}
					else if(item == this.data[this.sub])
					{
						if(this.data[this.sup])
						{
							def = this.data[0].focusInFromRight(this,def);
							this.data[this.sub]=null;
							return def;
						}
						else 
						{
							var mrow;
							if(this.data[0].EDProperties&&this.data[0].EDProperties.ghostElement) mrow = this.data[0].data[0];
							else mrow = this.data[0];
							def = this.parent.InsertAt(this.getIndex(),mrow.data,def);
							return this.Vanish(def);
						}
					}
					else if(item == this.data[0])
					{
						return this.Vanish(def);
					}
					else
						return def;
				},

			removeLeftNeighbor : function (item,def)
				{
					if(item&&item.parent == this&&item == this.data[this.sup])
					{
						if(this.data[this.sub])
						{
							return this.data[this.sub].DeleteFromRight(def);
						}
						else
						{
							return this.data[0].DeleteFromRight(def);
						}
					}
					else if(item&&item.parent == this&&item == this.data[this.sub])
					{
						return this.data[0].DeleteFromRight(def);
					}
					ED.Event.Beep();
					return {};
				},
			
			DeleteFromRight : function(def)
				{
					var prev;
					if(this.data[this.sup]) prev = this.data[this.sup];
					else if(this.data[this.sub]) prev = this.data[this.sub];
					else prev = this.data[this.base];
					if(prev)
					{
						return prev.DeleteFromRight(def);
					}
					return this.Vanish(def);
				},
			
			DeleteFromLeft : function(def)
				{
					if(this.data&&this.data[this.base])
					{
						return this.data[this.base].DeleteFromLeft(def);
					}
					return this.Vanish(def);
				}
		});
	
	MML.mfenced.Augment(
		{
			setTeXclass: function (prev) 
				{
					this.getPrevClass(prev);
					var values = this.getValues("open","close","separators"),
						attr = this.getValues("EDProperties"),
						def = {stretchy:true, texClass:MML.TEXCLASS.OPEN};
					values.open = values.open.replace(/[ \t\n\r]/g,"");
					values.close = values.close.replace(/[ \t\n\r]/g,"");
					values.separators = values.separators.replace(/[ \t\n\r]/g,"");
					// create a fake node for the open item
					if (values.open !== "") {
						if(attr&&(attr.EDProperties)&&(attr.EDProperties.open)) {HUB.Insert(def,attr.EDProperties.open)}
						this.SetData("open",MML.mo(values.open).With(def));
						prev = this.data.open.setTeXclass(prev);
					}
					// get the separators
					if (values.separators !== "") {
						while (values.separators.length < this.data.length)
						{values.separators += values.separators.charAt(values.separators.length-1)}
					}
					// handle the first item, if any
					if (this.data[0]) {prev = this.data[0].setTeXclass(prev)}
					// add fake nodes for separators and handle the following item
					for (var i = 1, m = this.data.length; i < m; i++) {
						if (this.data[i]) {
							if (values.separators !== "") {
							this.SetData("sep"+i,MML.mo(values.separators.charAt(i-1)));
							prev = this.data["sep"+i].setTeXclass(prev);
							}
							prev = this.data[i].setTeXclass(prev);
						}
					}
					// create fake node for the close item
					if (values.close !== "") {
						def = {stretchy:true, texClass:MML.TEXCLASS.CLOSE};
						if(attr&&(attr.EDProperties)&&(attr.EDProperties.close)) {HUB.Insert(def,attr.EDProperties.close)}
						this.SetData("close",MML.mo(values.close).With(def));
						prev = this.data.close.setTeXclass(prev);
					}
					// get the data from the open item
					this.updateTeXclass(this.data.open);
					return prev;
				},
			locateMMLhelper : function (spanID, stack,side,def)
				{
					if (spanID == this.data.open.spanID)
					{
						if(side == -1)
						{
							if (def) 
							{
								def.clickSide = -1;
								def.toLeft = this.getPrevious();
							}
							return this;
						}
						else
						{
							if (def) 
							{
								def.clickSide = -1;
								def.toLeft = null;
							}
							return this.data[0];
						}
					}
					else if (spanID == this.data.close.spanID)
					{
						if(side == 1)
						{
							if (def) 
							{
								def.clickSide = 1;
								def.toRight = this.getNext();
							}
							return this;
						}
						else
						{
							if (def) 
							{
								def.clickSide = 1;
								def.toRight = null;
							}
							return this.data[this.data.length -1];
						}
					}
					else stack.push.apply(stack,this.data);
				},
				
			focusOutToLeftFromChild : function (child,def)
				{
					var prev = child.getPrevious();
					
					if (prev)
					{
						return prev.focusRightToLeft(this,def)
					}
					else
					{
						if(this.EDProperties&&(this.EDProperties.ghostElement))
						{
							if(this.parent)
							{
								return this.parent.focusOutToLeftFromChild(this,def);
							}
						}
						else
						{
							def = this.focusInFromLeft(this,def);
							if(!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if(prev) def.mRow = prev.findParentMRow();}
						}
					}
					
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					var next = child.getNext();
					
					if (next)
					{
						return next.focusLeftToRight(this,def);
					}
					else
					{
						if(this.EDProperties&&(this.EDProperties.ghostElement))
						{
							if(this.parent)
							{
								return this.parent.focusOutToRightFromChild(this,def);
							}
						}
						else
						{
							def = this.focusInFromRight(this,def);
							if(!def.mRow) {next = (def.toLeft)?def.toLeft:def.toRight;if(next) def.mRow = next.findParentMRow()};
						}
					}
					
					return def
				},
		
			focusLeftToRight : function (item, def)
				{
					if((this.data)&&(this.data.length>0))
					{
						def.toLeft=null;
						return this.data[0].focusInFromLeft(this,def);
					}
					else 
					{
						var next = this.getNext();
					
						if (next)
						{
							def.toLeft = this;
							return next.focusInFromLeft(this,def);
						}
						else
						{
							var add = {
											toRight	: null,
											toLeft	: this,
											insertAt : this.getIndex()+1,
											clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
											clickSide : 1
										};
							for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
							return def
						}
					}
				},
			focusRightToLeft : function (item, def)
				{
					if((this.data)&&(this.data.length>0))
					{
						def.toRight=null;
						return this.data[this.data.length - 1].focusInFromRight(this,def);
					}
					else 
					{
						var prev = this.getPrevious();
					
						if (prev)
						{
							def.toRight = this;
							return prev.focusInFromRight(this,def)
						}
						else
						{
							var add = {
											toRight	: this,
											toLeft	: null,
											insertAt : this.getIndex(),
											clickSpan : document.getElementById("MathJax-Span-"+this.spanID),
											clickSide : -1
										};
							for (var id in add) {if (add.hasOwnProperty(id)) {def[id] = add[id]}}
							return def
						}
					}
				},
		/********* Editing Code **************************************************************************/

			removePlaceHolder : function(item,def)
				{
					if(item == this.data[0])
					{
						return this.Vanish(def);
					}
					else
						return def;
				},

			removeLeftNeighbor : function (item,def)
				{
					if(this.EDProperties&&this.EDProperties.ghostElement)
					{
						ED.Event.Beep();
						return {};
					}
					else
					{
						if(this.data)
						{
							if(this.data.lenght==1)
							{
								if(this.data[0].type=="mrow")
								{
									def = this.parent.InsertAt(this.getIndex(),this.data[0].data,def);
								}
								else
								{
									def = this.parent.InsertAt(this.getIndex(),this.data[0],def);
								}
								return this.Vanish(def);
							}
						}
					}
					ED.Event.Beep();
					return {};
				},
			
			DeleteFromRight : function(def)
				{
					var prev;
					if(this.data&&this.data.length) prev = this.data[this.data.length-1];
					if(prev)
					{
						return prev.DeleteFromRight(def);
					}
					return def;
				},
			
			DeleteFromLeft : function(def)
				{
					if(this.data&&this.data[0])
					{
						return this.data[0].DeleteFromLeft(def);
					}
					return def;
				}
		});
	
	MML.mroot.Augment(
		{
			focusOutToLeftFromChild : function (child,def)
				{
					if (child == this.data[0]) //under the root
					{
						return this.data[1].focusRightToLeft(this,def) //switch to the root power
					}
					else
					{
						var prev = this.getPrevious();
						if(prev)
						{
							def.toRight = this;
							return prev.focusInFromRight(this,def);
						}
						else
						{
							def.toLeft = null;
							return this.focusInFromLeft(this,def);
						}
					}
				
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					if (child == this.data[1])//inside the power
					{
						return this.data[0].focusLeftToRight(this,def)//switch to the mrow under the root
					}
					else
					{
						var next = this.getNext();
						if(next)
						{
							def.toLeft = this;
							return next.focusInFromLeft(this,def);
						}
						else
						{
							def.toRight = null;
							return this.focusInFromRight(this,def);
						}
					}
				
					return def
				},
		
			focusLeftToRight : function (item, def)
				{
					var next;
					def = this.data[1].focusLeftToRight(this,def);
					if (!def.mRow) {next = (def.toRight)?def.toRight:def.toLeft; if (next) def.mRow = next.findParentMRow();}
					return def;
				},
			focusRightToLeft : function (item, def)
				{
					var prev;
					def = this.data[0].focusRightToLeft(this,def);
					if (!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if (prev) def.mRow = prev.findParentMRow();}
					return def;
				},

		/********* Editing Code **************************************************************************/

			removePlaceHolder : function(item,def)
				{
					if(item == this.data[0])
					{
						return this.Vanish(def);
					}
					else if(item == this.data[1])
					{
						if(this.data[0])
						{
							var indx = this.getIndex(), mml = MML.msqrt(this.data[0]);
							
							def = this.parent.InsertAt(indx+1,mml,def);
							
							return this.Vanish(def);
						}
						else
							return this.Vanish(def);
					}
					else
						return def;
				},

			removeLeftNeighbor : function (item,def)
				{
					if(item&&item.parent == this&&item == this.data[0])
					{
						var indx = this.getIndex();
						//Remove the root element form the parent mRow
						if (indx>0) 
						{
							def = {toLeft: this.parent.data[indx-1],mRow : this.parent};
						}
						else
						{
							def = {toLeft:null,mRow:this.parent};
						}
						if(!this.data[0].emptyMRow)
						{
							def.toRight = this.data[0].data[0];
							this.parent.InsertAt(indx+1,this.data[0].data);
						}
						else
						{
							def.toRight = this.getNext();
						}
						this.Vanish();
						if(def.toLeft)
						{
							def = def.toLeft.focusInFromRight(def.toLeft,def);
						}
						else if(def.toRight)
						{
							def = def.toRight.focusInFromLeft(def.toRight,def);
						}
						else
						{
							def.clickSide = 0;
						}
						return def;
					}
					else if(item&&item.parent == this&&item == this.data[1])
					{
						if(this.data[1].emptyMRow)
						{// convert the n-th root into a square root. The root number placeholder is empty, just remove it.
							return this.removePlaceHolder(this.data[0],def);
						}
					}
					ED.Event.Beep();
					return {};
				},
			
			DeleteFromRight : function(def)
				{
					if(this.data&&this.data.length>0)
					{
						return this.data[0].DeleteFromRight(def);
					}
					return this.Vanish(def);
				},
			
			DeleteFromLeft : function(def)
				{
					if(this.data&&this.data.length>0)
					{
						return this.data[1].DeleteFromLeft(def);
					}
					return this.Vanish(def);
				}
			
		});
	
	MML.msqrt.Augment(
		{
			focusOutToLeftFromChild : function (child,def)
				{
					var prev = this.getPrevious();
					if(prev)
					{
						def.toRight = this;
						return prev.focusInFromRight(this,def);
					}
					else
					{
						def.toLeft = null;
						return this.focusInFromLeft(this,def);
					}
					return def
				},
		
			focusOutToRightFromChild : function (child,def)
				{
					var next = this.getNext();
					if(next)
					{
						def.toLeft = this;
						return next.focusInFromLeft(this,def);
					}
					else
					{
						def.toRight = null;
						return this.focusInFromRight(this,def);
					}
					return def
				},
		
			focusLeftToRight : function (item, def)
				{
					var next;
					def = this.data[0].focusLeftToRight(this,def);
					if (!def.mRow) {next = (def.toRight)?def.toRight:def.toLeft; if (next) def.mRow = next.findParentMRow();}
					return def;
				},
			focusRightToLeft : function (item, def)
				{
					var prev;
					def = this.data[0].focusRightToLeft(this,def);
					if (!def.mRow) {prev = (def.toLeft)?def.toLeft:def.toRight; if (prev) def.mRow = prev.findParentMRow();}
					return def;
				},

		/********* Editing Code **************************************************************************/

			removePlaceHolder : function(item,def)
				{
					if(item == this.data[0])
					{
						return this.Vanish(def);
					}
					else
						return def;
				},

			removeLeftNeighbor : function (item,def)
				{
					if(item&&item.parent == this&&item == this.data[0])
					{
						var indx = this.getIndex();
						//Remove the root element form the parent mRow
						if (indx>0) 
						{
							def = {toLeft: this.parent.data[indx-1],mRow : this.parent};
						}
						else
						{
							def = {toLeft:null,mRow:this.parent};
						}
						if(!this.data[0].emptyMRow)
						{
							def.toRight = this.data[this.den].data[0];
							this.parent.InsertAt(indx+1,this.data[0].data);
						}
						else
						{
							def.toRight = this.getNext();
						}
						this.Vanish();
						if(def.toLeft)
						{
							def = def.toLeft.focusInFromRight(def.toLeft,def);
						}
						else if(def.toRight)
						{
							def = def.toRight.focusInFromLeft(def.toRight,def);
						}
						else
						{
							def.clickSide = 0;
						}
						return def;
					}
					ED.Event.Beep();
					return {};
				},
			
			DeleteFromRight : function(def)
				{
					if(this.data&&this.data.length>0)
					{
						return this.data[0].DeleteFromRight(def);
					}
					return this.Vanish(def);
				},
			
			DeleteFromLeft : function(def)
				{
					if(this.data&&this.data.length>0)
					{
						return this.data[0].DeleteFromLeft(def);
					}
					return this.Vanish(def);
				}
		});
	});

MathJax.Ajax.loadComplete("[MathJax]/extensions/Editor/editor.js");
