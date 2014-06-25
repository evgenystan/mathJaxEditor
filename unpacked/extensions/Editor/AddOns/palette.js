/*************************************************************
 *
 *  MathJax/extensions/Editor/AddOns/palette.js
 *
 *  Show an editing palette with buttons and stuff.
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
	var ED = MathJax.Extension.Editor, PALETTE;

		PALETTE = ED.palette = {
				config : {},
				paletteDiv : null,
				Config : function()
					{
						var item, span;
						
						PALETTE.paletteDiv = HTML.Element("div",{isMathJax:true,EDkeepFocus:true});
						
						PALETTE.paletteDiv.setAttribute("class","palette-frame hidden");
						
						for (var i =0, m=PALETTE.paletteDef.length;i<m;i++)
						{
							item = PALETTE.paletteDef[i];
							if(PALETTE.buttons[item])
							{
								item = PALETTE.buttons[item];
								if(item.latex) {item = item.latex}
								span = HTML.Element("span", {isMathJax:true,EDkeepFocus:true},item);
								
								span.setAttribute("class","palette-button");
								PALETTE.paletteDiv.appendChild(span);
							}
						}
						
						document.body.appendChild(PALETTE.paletteDiv);
					},
					
				addClass: function ( classname, element ) 
					{
						var cn = element.className;
						//test for existance
						if( cn.indexOf( classname ) != -1 ) {
							return;
						}
						//add a space if the element already has class
						if( cn != '' ) {
							classname = ' '+classname;
						}
						element.className = cn+classname;
					},

				removeClass : function ( classname, element ) 
					{
						var cn = element.className;
						var rxp = new RegExp( "\\s?\\b"+classname+"\\b", "g" );
						cn = cn.replace( rxp, '' );
						element.className = cn;
					},
				
				Show : function ()
					{
						this.removeClass("hidden",this.paletteDiv)
					},

				Hide : function ()
					{
						this.addClass("hidden",this.paletteDiv)
					},

				buttons : 
					{
						integral : 
							{
								latex : "\\int"
							}
					},
				paletteDef : ["integral"]
			};

	MathJax.Hub.Register.StartupHook("MathJax Editor Ready",function () {
		AJAX.Require(ED.directory+"AddOns/palette.css");
					
		ED.Event.Register.EventListener(null,"Focus",function (){PALETTE.Show()});
		ED.Event.Register.EventListener(null,"Blur",function (){PALETTE.Hide()});
	});
	
	MathJax.Hub.Register.StartupHook("onLoad",CALLBACK(PALETTE.Config));
})(MathJax.Hub,MathJax.HTML,MathJax.Ajax,MathJax.Callback);

MathJax.Ajax.loadComplete("[MathJax]/extensions/Editor/AddOns/palette.js");