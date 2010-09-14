/**
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Library General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 * The dmx console.
 * Copyright (C) 2010 Simon Newton
 */

goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.ui.Component');
goog.require('goog.ui.Container');
goog.require('goog.ui.Control');
goog.require('goog.ui.Slider');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.ToolbarSeparator');

goog.provide('ola.DmxConsole');


/**
 * The class representing the console.
 * @constructor
 */
ola.DmxConsole = function() {
  this.setup = false;

  this.sliders = new Array();
  this.slider_values = new Array();
  this.data = new Array(ola.DmxConsole.NUMBER_OF_CHANNELS);
  this.value_cells = new Array();
  this.slider_offset = 0;
};
goog.inherits(ola.DmxConsole, goog.events.EventTarget);

/** The number of sliders to render */
ola.DmxConsole.NUMBER_OF_SLIDERS = 16;
ola.DmxConsole.NUMBER_OF_CHANNELS = 512;
ola.DmxConsole.MAX_CHANNEL_VALUE = 255;
ola.DmxConsole.CHANGE_EVENT = 'console-change-event';
ola.DmxConsole.CHANNELS_PER_ROW = 10;


/**
 * We use events here so we can throttle the rate.
 * @constructor
 */
ola.DmxConsoleChangeEvent = function() {
  goog.events.Event.call(this, ola.DmxConsole.CHANGE_EVENT);
};
goog.inherits(ola.DmxConsoleChangeEvent, goog.events.Event);


/**
 * Return the console data as an array
 * @return {Array.<number>} a list of channel data from the console.
 */
ola.DmxConsole.prototype.getData = function() {
  return this.data;
};


/**
 * Reset the console. This resets the underlying data but doesn't update the
 * screen.
 */
ola.DmxConsole.prototype.resetConsole = function() {
  var data_length = this.data.length;
  for (var i = 0; i < data_length; ++i) {
    this.data[i] = 0;
  }
  this.slider_offset = 0;
}


/**
 * Setup the console if it hasn't already been setup
 */
ola.DmxConsole.prototype.setupIfRequired = function() {
  if (this.setup) {
    return;
  }

  // setup the toolbar
  var toolbar = new goog.ui.Toolbar();
  this.previous_page_button = new goog.ui.ToolbarButton('Previous Page');
  this.next_page_button = new goog.ui.ToolbarButton('Next Page');
  this.previous_page_button.setEnabled(false);

  var blackout_button = new goog.ui.ToolbarButton('Blackout');
  blackout_button.setTooltip('Set all channels to 0');
  var full_button = new goog.ui.ToolbarButton('Full');
  full_button.setTooltip('Set all channels to full');

  toolbar.addChild(this.previous_page_button, true);
  toolbar.addChild(this.next_page_button, true);
  toolbar.addChild(new goog.ui.ToolbarSeparator(), true);
  toolbar.addChild(blackout_button, true);
  toolbar.addChild(full_button, true);
  toolbar.render(goog.dom.getElement('console_toolbar'));

  goog.events.listen(this.previous_page_button,
                     goog.ui.Component.EventType.ACTION,
                     this._previousPageClicked,
                     false,
                     this);

  goog.events.listen(this.next_page_button,
                     goog.ui.Component.EventType.ACTION,
                     this._nextPageClicked,
                     false,
                     this);

  goog.events.listen(blackout_button,
                     goog.ui.Component.EventType.ACTION,
                     this._blackoutButtonClicked,
                     false,
                     this);

  goog.events.listen(full_button,
                     goog.ui.Component.EventType.ACTION,
                     this._fullButtonClicked,
                     false,
                     this);

  // setup the value display
  var value_table = goog.dom.$('channel_values');
  for (var i = 0; i < ola.DmxConsole.NUMBER_OF_CHANNELS; ++i) {
    var div = goog.dom.createElement('div');
    div.innerHTML = 0;
    div.title = 'Channel ' + (i + 1);
    goog.dom.appendChild(value_table, div);
    this.value_cells.push(div);
  }

  // setup the sliders
  var channel_row = goog.dom.$('console_channel_row');
  var value_row = goog.dom.$('console_value_row');
  var slider_row = goog.dom.$('console_slider_row');

  for (var i = 0; i < ola.DmxConsole.NUMBER_OF_SLIDERS; ++i) {
    var channel_td = goog.dom.createElement('td');
    channel_td.innerHTML = i + 1;
    goog.dom.appendChild(channel_row, channel_td);

    var value_td = goog.dom.createElement('td');
    value_td.innerHTML = '0';
    goog.dom.appendChild(value_row, value_td);
    this.slider_values.push(value_td);

    var slider_td = goog.dom.createElement('td');
    goog.dom.appendChild(slider_row, slider_td);
    var slider = new goog.ui.Slider;
    slider.setOrientation(goog.ui.Slider.Orientation.VERTICAL);
    slider.setMinimum(0);
    slider.setMaximum(ola.DmxConsole.MAX_CHANNEL_VALUE);
    slider.render(slider_td);

    goog.events.listen(
        slider,
        goog.ui.Component.EventType.CHANGE,
        (function(offset) {
          return function() { this._sliderChanged(offset) }; }
        )(i),
        false, this);
    this.sliders.push(slider);
  }
  this.setup = true;

  // zero data
  this._setAllChannels(0);
};


/**
 * Update the console to reflect the data. This is called when it becomes
 * visible.
 */
ola.DmxConsole.prototype.update = function() {
  // set the state of the prev / next buttons
  if (this.slider_offset == 0) {
    this.previous_page_button.setEnabled(false);
  } else {
    this.previous_page_button.setEnabled(true);
  }

  if (this.slider_offset == ola.DmxConsole.NUMBER_OF_CHANNELS -
             ola.DmxConsole.NUMBER_OF_SLIDERS) {
    this.next_page_button.setEnabled(false);
  } else {
    this.next_page_button.setEnabled(true);
  }

  // update the slider offsets
  this._updateSliderOffsets();

  // set the values of the sliders
  for (var i = 0; i < this.sliders.length; ++i) {
    this.sliders[i].setValue(this.data[i]);
  }

  // update all channel valuess
  var data_length = this.data.length;
  for (var i = 0; i < data_length; ++i) {
    this._setCellValue(i, this.data[i]);
  }
}

/**
 * Called when the next page button is clicked
 */
ola.DmxConsole.prototype._nextPageClicked = function() {
  this.slider_offset += ola.DmxConsole.NUMBER_OF_SLIDERS;
  this.previous_page_button.setEnabled(true);
  var page_limit = (ola.DmxConsole.NUMBER_OF_CHANNELS -
    ola.DmxConsole.NUMBER_OF_SLIDERS);
  if (this.slider_offset >= page_limit) {
    this.slider_offset = page_limit;
    this.next_page_button.setEnabled(false);
  }
  this._updateSliderOffsets();
};


/**
 * Called when the previous page button is clicked
 */
ola.DmxConsole.prototype._previousPageClicked = function() {
  this.slider_offset -= ola.DmxConsole.NUMBER_OF_SLIDERS;
  this.next_page_button.setEnabled(true);
  if (this.slider_offset <= 0) {
    this.slider_offset = 0;
    this.previous_page_button.setEnabled(false);
  }
  this._updateSliderOffsets();
};


/**
 * Update the slider offsets.
 */
ola.DmxConsole.prototype._updateSliderOffsets = function() {
  var channel_row = goog.dom.$('console_channel_row');
  var td = goog.dom.getFirstElementChild(channel_row);
  var i = this.slider_offset;
  while (i < this.data.length && td != undefined) {
    td.innerHTML = i + 1;
    i++;
    td = goog.dom.getNextElementSibling(td);
  }
};


/**
 * Called when the blackout button is clicked.
 */
ola.DmxConsole.prototype._blackoutButtonClicked = function() {
  this._setAllChannels(0);
};


/**
 * Called when the full on button is clicked.
 */
ola.DmxConsole.prototype._fullButtonClicked = function() {
  this._setAllChannels(ola.DmxConsole.MAX_CHANNEL_VALUE);
};


/**
 * Set all channels to a value.
 * @param {number} value the value to set all channels to.
 */
ola.DmxConsole.prototype._setAllChannels = function(value) {
  var data_length = this.data.length;
  for (var i = 0; i < data_length; ++i) {
    this.data[i] = value;
    this._setCellValue(i, value);
  }
  for (var i = 0; i < this.sliders.length; ++i) {
    this.sliders[i].setValue(value);
  }
  this.dispatchEvent(new ola.DmxConsoleChangeEvent());
};


/**
 * Called when the value of a slider changes.
 * @param {number} offset the offset of the slider that changed.
 */
ola.DmxConsole.prototype._sliderChanged = function(offset) {
  var value = this.sliders[offset].getValue();
  this.slider_values[offset].innerHTML = value;
  var channel = this.slider_offset + offset;
  this._setCellValue(channel, value);

  if (this.data[channel] != value) {
    this.data[channel] = value;
    this.dispatchEvent(new ola.DmxConsoleChangeEvent());
  }
};


/**
 * Set the value of a channel cell
 * @param {number} offset the channel offset.
 * @param {number} value the value to set the channel to.
 */
ola.DmxConsole.prototype._setCellValue = function(offset, value) {
  var element = this.value_cells[offset];
  if (element == undefined) {
    return;
  }
  element.innerHTML = value;
  var remaining = ola.DmxConsole.MAX_CHANNEL_VALUE - value;
  element.style.background = 'rgb(' + remaining + ',' + remaining + ',' +
    remaining + ')';
  if (value > 90) {
    element.style.color = '#ffffff';
  } else {
    element.style.color = '#000000';
  }
};