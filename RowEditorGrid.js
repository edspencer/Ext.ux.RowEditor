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