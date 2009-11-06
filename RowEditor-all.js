/*!
 * Ext JS Library 3.0+
 * Copyright(c) 2006-2009 Ext JS, LLC
 * licensing@extjs.com
 * http://www.extjs.com/license
 */
Ext.ns('Ext.ux.grid');

/**
 * @class Ext.ux.grid.RowEditor
 * @extends Ext.Panel 
 * Plugin (ptype = 'roweditor') that adds the ability to rapidly edit full rows in a grid.
 * A validation mode may be enabled which uses AnchorTips to notify the user of all
 * validation errors at once.
 * 
 * @ptype roweditor
 */
Ext.ux.grid.RowEditor = Ext.extend(Ext.Panel, {
  floating: true,
  shadow  : false,
  layout  : 'hbox',
  
  cls    : 'x-small-editor',
  baseCls: 'x-row-editor',
  style  : 'z-index: 8000;',
  
  buttonAlign : 'center',
  elements    : 'header,footer,body',
  frameWidth  : 5,
  buttonPad   : 3,
  clicksToEdit: 'auto',
  focusDelay  : 250,
  
  /**
   * @cfg errorSummary
   * @type Boolean
   * True to show an error summary ToolTip when there are validation errors in one or more fields
   */
  errorSummary: true,
  
  /**
   * @cfg monitorValid
   * @type Boolean
   * True to monitor whether fields are valid or invalid, and show tooltip if not (defaults to true)
   */
  monitorValid: true,
  
  /**
   * @cfg monitorPoll
   * @type Number
   * Polling interval to use when validating fields (defaults to 200 milliseconds)
   */
  monitorPoll: 200,
  
  /**
   * @cfg saveText
   * @type String
   * The text to use on the Save button (defaults to "Save")
   */
  saveText: "Save",
  
  /**
   * @cfg cancelText
   * @type String
   * The text to use on the Cancel button (defaults to "Cancel")
   */
  cancelText: "Cancel",

  defaults: {
    normalWidth: true
  },

  initComponent: function(){
    Ext.ux.grid.RowEditor.superclass.initComponent.call(this);
    
    this.addEvents(
      /**
       * @event beforeedit
       * Fired before the row editor is activated.
       * If the listener returns <tt>false</tt> the editor will not be activated.
       * @param {Ext.ux.grid.RowEditor} roweditor This object
       * @param {Number} rowIndex The rowIndex of the row just edited
       */
      'beforeedit',
      
      /**
       * @event validateedit
       * Fired after a row is edited and passes validation.
       * If the listener returns <tt>false</tt> changes to the record will not be set.
       * @param {Ext.ux.grid.RowEditor} roweditor This object
       * @param {Object} changes Object with changes made to the record.
       * @param {Ext.data.Record} r The Record that was edited.
       * @param {Number} rowIndex The rowIndex of the row just edited
       */
      'validateedit',
      
      /**
       * @event afteredit
       * Fired after a row is edited and passes validation.  This event is fired
       * after the store's update event is fired with this edit.
       * @param {Ext.ux.grid.RowEditor} roweditor This object
       * @param {Object} changes Object with changes made to the record.
       * @param {Ext.data.Record} r The Record that was edited.
       * @param {Number} rowIndex The rowIndex of the row just edited
       */
      'afteredit'
    );
  },

  init: function(grid){
    this.grid = grid;
    this.ownerCt = grid;
    
    this.initListeners();
  },
  
  /**
   * Sets up listeners on the grid, its ColumnModel and its GridView
   */
  initListeners: function() {
    var grid = this.grid;
    
    if (this.clicksToEdit === 2) {
      grid.on('rowdblclick', this.onRowDblClick, this);
    } else {
      grid.on('rowclick', this.onRowClick, this);
      
      if (Ext.isIE) grid.on('rowdblclick', this.onRowDblClick, this);
    }

    grid.on({
      scope       : this,
  	  destroy     : this.destroy,
  	  
      keydown     : this.onGridKey,
      columnresize: this.verifyLayout,
      columnmove  : this.refreshFields,
      reconfigure : this.refreshFields,
      
      bodyscroll  : {
        buffer: 250,
        fn    : this.positionButtons
      }
    });
    
    grid.getColumnModel().on('hiddenchange', this.verifyLayout, this, {delay:1});
    grid.getView().on('refresh', this.stopEditing.createDelegate(this, []));
    grid.getStore().on('remove', this.stopEditing.createDelegate(this, [false]), this);
  },

  refreshFields: function(){
    this.initFields();
    this.verifyLayout();
  },

  /**
   * Examines all fields for changes, returns true if any have changed
   * @return {Boolean} True if any field has been changed
   */
  isDirty: function(){
    var dirty = false;
    
    for (var k in this.getChanges()) {
      dirty = true;
    }
    
    return dirty;
  },

  /**
   * Opens the RowEditor at the given rowIndex and optionally focusses the first editor
   * @param {Number/Ext.data.Record} rowIndex The rowIndex of the row to focus, or the record itself
   * @param {Boolean} doFocus True to automatically focus the first editor in the row (defaults to true)
   */
  startEditing: function(rowIndex, doFocus) {
    doFocus = doFocus || true;
    
    if(this.editing && this.isDirty()){
      this.showTooltip('You need to commit or cancel your changes');
      return;
    }
    
    if (Ext.isObject(rowIndex)) rowIndex = this.grid.getStore().indexOf(rowIndex);
    
    if(this.fireEvent('beforeedit', this, rowIndex) !== false){
      var grid   = this.grid,
          view   = grid.getView(),
          row    = view.getRow(rowIndex),
          record = grid.store.getAt(rowIndex);
      
      this.editing  = true;
      this.record   = record;
      this.rowIndex = rowIndex;
      this.values   = {};

      //make sure we're rendered and sized correctly
      if (!this.rendered) this.render(view.getEditorParent());      
      this.setSize(Ext.fly(row).getWidth());
      if (!this.initialized) this.initFields();
      
      this.setValues(record);
      this.verifyLayout(true);
      this.positionAtRow(row);      
      
      if (!this.isVisible()) this.show().doLayout();
      if (doFocus !== false) this.doFocus.defer(this.focusDelay, this);
    }
  },
  
  /**
   * Collects any user changes and updates the current record with them.
   * @param {Boolean} saveChanges True to save changes (otherwise they are discarded)
   */
  stopEditing : function(saveChanges){
    this.editing = false;
    
    if (!this.isVisible()) return;
    
    if (saveChanges === false || !this.isValid()) {
      this.hide();
      return;
    }
    
    if (this.isDirty()) this.updateRecord(this.record, this.getChanges());
    
    this.hide();
  },
  
  /**
   * Moves the RowEditor to the given row
   * @param {HtmlElement} row The row to move to
   */
  positionAtRow: function(row) {
    if (!this.isVisible()){
      this.setPagePosition(Ext.fly(row).getXY());
    } else{
      this.el.setXY(Ext.fly(row).getXY(), {duration:0.15});
    }
  },
  
  /**
   * Iterates over each field in the RowEditor with the given iterator function and scope
   * @param {Function} fn The iterator function, which will be passed the following arguments:
   * <ul>
   *   <li>field - The Editor object</li>
   *   <li>colModel - The grid's column model</li>
   *   <li>index - The current iterator index</li>
   * </ul>
   * @param {Object} scope The scope to execute the iterator function in
   */
  eachField: function(fn, scope) {
    scope = scope || this;
    
    var colModel = this.grid.colModel;
    
    for (var i = 0, len = colModel.getColumnCount(); i < len; i++) {
      var field = this.items.items[i];
      
      fn.call(scope, field, colModel, i);
    }
  },
  
  /**
   * Sets the value of each field based on the given record
   * @param {Ext.data.Record} record The Record to take values from (defaults to this.record)
   */
  setValues: function(record) {
    record = record || this.record;
    
    this.eachField(function(field, colModel, index) {
      var value = this.preEditValue(record, colModel.getDataIndex(index));
      
      field.setValue(value);
      
      if (field.getXType() == 'roweditor-display-field') {
        var column = colModel.getColumnAt(index);
        
        if (column.renderer != undefined) {
          field.setDisplayValue(column.renderer.call(column, value, {}, record));
        }
      };
      
      this.values[field.id] = Ext.isEmpty(value) ? '' : value;
    }, this);
    
    // var cm     = grid.getColumnModel(),
    //     fields = this.items.items, f, val;
    // 
    // for(var i = 0, len = cm.getColumnCount(); i < len; i++){
    //   val = this.preEditValue(record, cm.getDataIndex(i));
    //   f   = fields[i];
    //   
    //   //START CHANGES
    //   if (f.getXType() == 'combo') {
    //     var combo       = f,
    //         store       = combo.store,
    //         value       = combo.getValue(),
    //         recordIndex = store.find(combo.valueField, (value || "").toString());
    //     
    //     if (recordIndex == -1 && !Ext.isEmpty(value)) {
    //       //if the record that our combo is pointing to isn't in the store, create a fake one and add it
    //       var data = {};
    //       data[combo.valueField]   = value;
    //       data[combo.displayField] = record.get(combo.displayField);
    //      
    //       var fakeRecord = new store.recordType(data);
    //       store.add(fakeRecord);
    //      
    //       combo.setValue(value);
    //     }
    //   } else if (f.getXType() == 'displayfield') {
    //     var column = cm.getColumnById(cm.getColumnId(i));
    //     
    //     if (column.renderer != undefined) {
    //       val = column.renderer.call(column, val, {}, record);
    //       f.setValue(val);
    //     }
    //   } else {
    //     f.setValue(val);
    //   }
    //   
    //   //END CHANGES
  },
  
  /**
   * Returns an object containing the changes the user has made while editing
   * @return {Object} All changes made by the user
   */
  getChanges: function() {
    var record    = this.record,
        changes   = {},
        hasChange = false,
        colModel  = this.grid.colModel,
        fields    = this.items.items;
    
    //collect any changes from the fields
    for (var i = 0, len = colModel.getColumnCount(); i < len; i++) {
      var dataIndex = colModel.getDataIndex(i);
      
      if (!colModel.isHidden(i) && !Ext.isEmpty(dataIndex)) {
        var field    = fields[i],
            oldValue = record.get(dataIndex),
            newValue = Ext.isFunction(field.getSubmitValue) ? field.getSubmitValue() : field.getValue(),
            value    = this.postEditValue(newValue, oldValue, record, dataIndex);
        
        if (String(oldValue) !== String(newValue)) changes[dataIndex] = value;
      }
    }
    
    return changes;
  },
  
  /**
   * Applies an object full of changes to a given record, fires events
   * @param {Ext.data.Record} record The record to update
   */
  updateRecord: function(record, changes) {
    if (this.fireEvent('validateedit', this, changes, record, this.rowIndex) !== false) {
      record.beginEdit();
      for (var k in changes) {
        record.set(k, changes[k]);
      }
      record.endEdit();
      
      this.fireEvent('afteredit', this, changes, record, this.rowIndex);
    }
  },

  /**
   * Ensures that the RowEditor and each field is correctly sized
   * @param {Boolean} force True to force resizing even if the RowEditor is not currently visible
   */
  verifyLayout: function(force) {
    if (this.el && (this.isVisible() || force === true)){
      var row = this.grid.getView().getRow(this.rowIndex);
      
      this.setSize(Ext.fly(row).getWidth(), Ext.isIE ? Ext.fly(row).getHeight() + 9 : undefined);
      
      var cm     = this.grid.colModel,
          fields = this.items.items;
      
      //set the size of each field
      for (var i = 0, len = cm.getColumnCount(); i < len; i++) {
        var field = fields[i];
        
        if (cm.isHidden(i)) {
          field.hide();
        } else {
          //add 1px padding to each field, or 3px for the last column's field
          var adjust = (i === (len - 1)) ? 3 : 2;
          
          field.show();
          field.setWidth(cm.getColumnWidth(i) - adjust);          
        }
      }
      
      this.doLayout();
      this.positionButtons();
    }
  },

  /**
   * Sets up each field, sets appropriate margins and adds listeners
   */
  initFields: function(){
    var cm = this.grid.getColumnModel(),
        pm = Ext.layout.ContainerLayout.prototype.parseMargins;
    
    this.removeAll(false);
    
    for (var i = 0, len = cm.getColumnCount(); i < len; i++){
      var column  = cm.getColumnAt(i),
          editor  = column.getEditor(),
          margins = {
            top: 0, right: 1, bottom: 2, left: 1
          };
      
      //if there is no editor for this column, just use a DisplayField
      editor = editor || column.displayEditor || new Ext.ux.grid.RowEditor.DisplayField();
      
      //the editor in the last column gets no margin-right
      if (i == (len - 1)) margins.right = 0;
      
      editor.margins = margins;
      editor.setWidth(cm.getColumnWidth(i));
      editor.column = column;
      
      if (editor.ownerCt !== this) {
        editor.on({
          scope     : this,
          focus     : this.ensureVisible,
          specialkey: this.onKey
        });        
      }
      
      this.insert(i, editor);
    }
    
    this.initialized = true;
  },
  
  /**
   * If the Enter key is pressed while editing, trigger the stop editing with save action
   */
  onKey: function(f, e){
    if (e.getKey() === e.ENTER) {
      this.stopEditing(true);
      e.stopPropagation();
    }
  },

  /**
   * @private
   * Listener for grid keypress.  If the user presses Enter while a row is selected and
   * the RowEditor is not currently activated, the RowEditor is moved to that row and activated
   */
  onGridKey: function(e){
    if(e.getKey() === e.ENTER && !this.isVisible()){
      var record = this.grid.getSelectionModel().getSelected();
      
      if (record){
        var index = this.grid.store.indexOf(record);
        this.startEditing(index);
        e.stopPropagation();
      }
    }
  },

  /**
   * Scrolls the grid to ensure that a given editor is visible
   */
  ensureVisible: function(editor){
    if(this.isVisible()){
      var colIndex = this.grid.colModel.getIndexById(editor.column.id);
      
      this.grid.getView().ensureVisible(this.rowIndex, colIndex, true);
    }
  },

  onRowClick: function(g, rowIndex, e){
    if(this.clicksToEdit == 'auto'){
      var li = this.lastClickIndex;
      this.lastClickIndex = rowIndex;
      if(li != rowIndex && !this.isVisible()){
        return;
      }
    }
    this.startEditing(rowIndex, false);
    this.doFocus.defer(this.focusDelay, this, [e.getPoint()]);
  },

  onRowDblClick: function(g, rowIndex, e){
    this.startEditing(rowIndex, false);
    this.doFocus.defer(this.focusDelay, this, [e.getPoint()]);
  },

  /**
   * Creates and positions the Buttons panel after rendering
   */
  onRender: function() {
    Ext.ux.grid.RowEditor.superclass.onRender.apply(this, arguments);
    
    this.el.swallowEvent(['keydown', 'keyup', 'keypress']);
    
    this.btns = this.buildButtonPanel();
    this.btns.render(this.bwrap);
    this.positionButtons();
    
    if (this.monitorValid) this.startMonitoring();
  },
  
  /**
   * Builds and returns the Ext.Panel used to house the Save and Cancel buttons
   * @return {Ext.Panel} The Panel used to house the buttons
   */
  buildButtonPanel: function() {
    return new Ext.Panel({
      baseCls : 'x-plain',
      cls     : 'x-btns',
      elements: 'body',
      layout  : 'table',
      width   : (this.minButtonWidth * 2) + (this.frameWidth * 2) + (this.buttonPad * 4), // width must be specified for IE
      
      defaults: {
        xtype: 'button',
        width: this.minButtonWidth
      },
      
      items: [
        {
          ref    : 'saveBtn',
          itemId : 'saveBtn',
          text   : this.saveText,
          handler: this.stopEditing.createDelegate(this, [true])
        },
        {
          text   : this.cancelText,
          handler: this.stopEditing.createDelegate(this, [false])
        }
      ]
    });
  },

  onShow: function(){
    if (this.monitorValid) this.startMonitoring();
    
    Ext.ux.grid.RowEditor.superclass.onShow.apply(this, arguments);
  },

  onHide: function(){
    Ext.ux.grid.RowEditor.superclass.onHide.apply(this, arguments);
    
    this.stopMonitoring();
    this.grid.getView().focusRow(this.rowIndex);
  },

  /**
   * Repositions the buttons panel (Save + Cancel) in the centre of the visible space
   */
  positionButtons: function(){
    if (this.btns) {
      var buttons     = this.btns,
          view        = this.grid.getView(),
          scroll      = view.scroller.dom.scrollLeft,
          height      = this.el.dom.clientHeight,
          gridWidth   = view.mainBody.getWidth(),
          buttonWidth = buttons.getWidth();
          
      //position the buttons panel just underneath the RowEditor
      buttons.el.shift({
        left    : (gridWidth / 2) - (buttonWidth / 2) + scroll,
        top     : height - 2,
        stopFx  : true,
        duration: 0.2
      });
    }
  },

  // private
  preEditValue : function(record, field){
    return this.postEditValue(record.data[field]);
  },

  // private
  postEditValue : function(value, originalValue, r, field){
    return this.autoEncode && typeof value == 'string' 
           ? Ext.util.Format.htmlEncode(value) 
           : value;
  },

  doFocus: function(pt){
    if (this.isVisible()){
      var index = 0;
      if(pt){
        index = this.getTargetColumnIndex(pt);
      }
      var cm = this.grid.getColumnModel();
      for(var i = index||0, len = cm.getColumnCount(); i < len; i++){
        var c = cm.getColumnAt(i);
        if(!c.hidden && c.getEditor()){
          c.getEditor().focus();
          break;
        }
      }
    }
  },

  getTargetColumnIndex: function(pt){
    var grid = this.grid, v = grid.view;
    var x = pt.left;
    var cms = grid.colModel.config;
    var i = 0, match = false;
    for(var len = cms.length, c; c = cms[i]; i++){
      if(!c.hidden){
        if(Ext.fly(v.getHeaderCell(i)).getRegion().right >= x){
          match = i;
          break;
        }
      }
    }
    return match;
  },

  startMonitoring : function(){
    if (!this.bound && this.monitorValid) {
      this.bound = true;
      
      Ext.TaskMgr.start({
        scope   : this,
        run     : this.validate,
        interval: this.monitorPoll
      });
    }
  },

  stopMonitoring : function(){
    this.bound = false;
    
    if (this.tooltip) this.tooltip.hide();
  },

  /**
   * Returns whether the data in the row are currently valid
   * @return {Boolean} True if all fields are currently valid
   */
  isValid: function(){
    return this.getErrors().length == 0;
  },

  /**
   * @private
   * Runs all field validations. If any are invalid it shows the tooltip and disables save button.
   * This function is polled (see this.startMonitoring) every this.monitorPoll milliseconds
   */
  validate : function(){
    if (!this.bound){
      return false; // stops binding
    }
    
    var valid = this.isValid();
    
    //show the error tooltip and disable save button
    if (!valid && this.errorSummary) this.showTooltip(this.getErrorHtml());
    this.btns.saveBtn.setDisabled(!valid);
    
    this.fireEvent('validation', this, valid);
  },
  
  /**
   * Returns the tooltip tied to the RowEditor, creating it first if required
   * @return {Ext.ToolTip} The ToolTip object
   */
  getTooltip: function() {
    if (this.tooltip == undefined) {
      this.tooltip = new Ext.ToolTip({
        maxWidth: 600,
        width   : 300,
        cls     : 'errorTip',
        title   : 'Errors',
        autoHide: false,
        anchor  : 'left',
        
        anchorToTarget: true,
        mouseOffset   : [40,0]
      });
    }
    
    return this.tooltip;
  },

  /**
   * Shows the tooltip with a given message
   * @param {String} message The message to display
   */
  showTooltip: function(message){
    var tooltip = this.getTooltip(),
        view    = this.grid.getView(),
        top     = parseInt(this.el.dom.style.top, 10),
        scroll  = view.scroller.dom.scrollTop,
        height  = this.el.getHeight();
    
    if (top + height >= scroll) {
      tooltip.initTarget(this.items.last().getEl());
      
      if (!tooltip.rendered) {
        tooltip.show();
        tooltip.hide();
      }
      
      tooltip.body.update(message);
      tooltip.doAutoWidth();
      tooltip.show();
    } else {
      if (tooltip.rendered) tooltip.hide();
    }
  },
  
  /**
   * Returns an array of all errors on all fields in the RowEditor
   * @return {Array} Array of field errors
   */
  getErrors: function() {
    var errors = [];
    
    this.items.each(function(field) {
      if (!field.isValid(true)) {
        errors.push({
          name   : field.name,
          message: field.activeError
        });
      }
    });
    
    return errors;
  },
  
  /**
   * @property errorTpl
   * @type Ext.XTemplate
   * The XTemplate used to mark up errors into HTML
   */
  errorTpl: new Ext.XTemplate(
    '<ul>',
      '<tpl for=".">',
        '<li>{message}</li>',
      '</tpl>',
    '</ul>'
  ),

  /**
   * Builds an HTML <ul> fragment with a <li> for each validation error
   * @return {Array} Array of HTML fragments
   */
  getErrorHtml: function(){
    return this.errorTpl.apply(this.getErrors());
  }
});

Ext.preg('roweditor', Ext.ux.grid.RowEditor);

Ext.override(Ext.form.Field, {
  markInvalid : function(msg){
    if(!this.rendered || this.preventMark){ // not rendered
      return;
    }
    msg = msg || this.invalidText;

    var mt = this.getMessageHandler();
    if(mt){
      mt.mark(this, msg);
    }else if(this.msgTarget){
      this.el.addClass(this.invalidClass);
      var t = Ext.getDom(this.msgTarget);
      if(t){
        t.innerHTML = msg;
        t.style.display = this.msgDisplay;
      }
    }
    this.activeError = msg;
    this.fireEvent('invalid', this, msg);
  }
});

Ext.override(Ext.ToolTip, {
  doAutoWidth : function(){
    var bw = this.body.getTextWidth();
    if(this.title){
      bw = Math.max(bw, this.header.child('span').getTextWidth(this.title));
    }
    bw += this.getFrameWidth() + (this.closable ? 20 : 0) + this.body.getPadding("lr") + 20;
    this.setWidth(bw.constrain(this.minWidth, this.maxWidth));

    // IE7 repaint bug on initial show
    if(Ext.isIE7 && !this.repainted){
      this.el.repaint();
      this.repainted = true;
    }
  }
});

/**
 * @class Ext.ux.grid.RowEditor.DisplayField
 * @extends Ext.form.Field
 * Modification of the Ext.form.DisplayField, suitable for use with a RowEditor.
 * This DisplayField maintains its value separately from its presentation, meaning we can
 * continue to use a Column's renderer to preserve how the field looks when editing a row.
 */
Ext.ux.grid.RowEditor.DisplayField = Ext.extend(Ext.form.DisplayField, {
  /**
   * @property displayValue
   * @type String
   * The string to display instead of the actual value
   */
  displayValue: undefined,
  
  /**
   * Sets the field's display value and updates the DOM. This can be used to provide
   * a different display value to the raw value, similar to a combobox
   * @param {String} value The value to set the display to
   */
  setDisplayValue: function(value) {
    this.displayValue = value;
    
    this.setRawValue(this.getRawValue());
  },
  
  /**
   * Returns the current value assigned to the field
   * @return {Mixed} The current value of the field
   */
  getRawValue : function(){
    var v = Ext.value(this.value, '');
    
    if (v === this.emptyText) v = '';
    if (this.htmlEncode) v = Ext.util.Format.htmlDecode(v);
    
    return v;
  },
  
  /**
   * Sets the actual value stored in this field. To set the displayed value instead, use setDisplayValue
   */
  setRawValue: function(value) {
    if(this.htmlEncode){
      value = Ext.util.Format.htmlEncode(value);
    }
    
    var displayValue = this.displayValue || (Ext.isEmpty(value) ? '' : value);
    
    if (this.rendered) this.el.dom.innerHTML = displayValue;
    
    return this.value = value;
  }
});

Ext.reg('roweditor-display-field', Ext.ux.grid.RowEditor.DisplayField);

/**
 * @class ExtMVC.view.RowEditorGrid
 * @extends ExtMVC.view.scaffold.Index
 * Specialised scaffold grid sporting a row editor
 * @cfg {String} modelName The string name of the model this grid is for (required)
 * @cfg {String} controllerName The string name of the controller this grid dispatches to (required)
 */
ExtMVC.registerView('extmvc', 'rowEditorGrid', {
  xtype: 'scaffold_grid',
  registerXType: 'roweditor_grid',
  
  constructor: function(config) {
    config = config || {};
    
    /**
     * @property editor
     * @type Ext.ux.grid.RowEditor
     * The RowEditor instance
     */
    this.editor = new Ext.ux.grid.RowEditor(this.getRowEditorConfig());
    
    config.plugins = config.plugins || [];
    config.plugins.push(this.editor);

    Ext.applyIf(config, {
      model  : ExtMVC.getModel(this.modelName),
      store  : ExtMVC.getModel(this.modelName).find({}, {autoLoad: false}),
      dblClickToEdit: false
    });

    ExtMVC.getView("scaffold", "index").prototype.constructor.call(this, config);
  },
  
  /**
   * Builds the row editor config object. Override to provide your own implementation
   * @return {Object} The RowEditor config
   */
  getRowEditorConfig: function() {
    return {
      listeners: {
        scope: this,
        afteredit: function(editor, changes, record) {
          ExtMVC.dispatch(this.controllerName, "update", [record]);
        }
      }
    };
  },
  
  /**
   * Returns a new phantom instance of the model this grid is CRUDding - this is used as the record
   * in the new row when the user clicks the 'Add' button
   * @return {ExtMVC.model.Base} The new instance
   */
  buildNewInstance: function() {
    return ExtMVC.buildModel(this.modelName);
  },
  
  /**
   * Refreshes this grid's store
   */
  refresh: function() {
    this.store.reload();
  },
  
  onAdd: function() {
    var index  = this.store.getCount(),
        record = this.buildNewInstance();
    
    this.editor.stopEditing();

    //add our new record as the first row, select it
    this.store.insert(index, record);
    this.getView().refresh();
    this.getSelectionModel().selectRow(index);

    //start editing our new record
    this.editor.startEditing(index);
  },
  
  onEdit: function() {
    var record = this.getSelectionModel().getSelected();
    
    if (record != undefined) {
      this.editor.stopEditing();
      this.editor.startEditing(this.store.indexOf(record));
    }
  }
});

