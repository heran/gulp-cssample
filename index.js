'use strict';

var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var path = require('canonical-path');
var through2 = require('through2');
var gutil = require('gulp-util');
var File = gutil.File;
var CSSDEST = '__CSSAMPLE_DEST';
var fs = require('fs');
var NEW_LINE = /\n\r?/;
var marked = require('marked');


module.exports = function(fileName, template, typeSorts) {
  var content = '';

  if(!template){
    template = fs.readFileSync(__dirname+'/template.html', 'utf8');
  }

  if(!fileName){
    fileName = 'css.example';
  }

  function trim(text) {
    var MAX_INDENT = 9999;
    var empty = RegExp.prototype.test.bind(/^\s*$/);
    var lines = text.split('\n');
    var minIndent = MAX_INDENT;
    var indentRegExp;
    var ignoreLine = (lines[0][0] != ' '  && lines.length > 1);
    // ignore first line if it has no indentation and there is more than one line

    lines.forEach(function(line){
      if (ignoreLine) {
        ignoreLine = false;
        return;
      }

      var indent = line.match(/^\s*/)[0].length;
      if (indent > 0 || minIndent == MAX_INDENT) {
        minIndent = Math.min(minIndent, indent);
      }
    });

    indentRegExp = new RegExp('^\\s{0,' + minIndent + '}');

    for ( var i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(indentRegExp, '');
    }

    // remove leading lines
    while (empty(lines[0])) {
      lines.shift();
    }

    // remove trailing
    while (empty(lines[lines.length - 1])) {
      lines.pop();
    }
    return lines.join('\n');
  }

  function parseCssExample(example){
    var docs = [];
    var lines = example.toString().split(NEW_LINE);
    var text;
    var startingLine ;
    var match;
    var inDoc = false;
    lines.forEach(function(line, lineNumber){
      lineNumber++;
      // is the comment starting?
      if (!inDoc && (match = line.match(/^\s*<!--@cssample:start-->\s*(.*)$/))) {
        line = match[1];
        inDoc = true;
        text = [];
        startingLine = lineNumber;
      }
      // are we done?
      if (inDoc && line.match(/<!--@cssample:end-->/)) {
        text = text.join('\n');
        text = text.replace(/^\n/, '');
        docs.push(new Doc(text).parase());
        inDoc = false;
      }
      // is the comment add text
      if (inDoc){
        text.push(line);
      }
    });
    
    docs.sort(function (a, b) {
      var ka, kb;
      if(typeSorts){
        ka = _.findKey(typeSorts, a.module);
        kb = _.findKey(typeSorts, b.module);
      }
      if(ka == kb){
        return a.name> b.name ? -1 :(a.name< b.name ? 1 :0);
      }else{
        return ka < kb ? 1 : (ka>kb ? -1 : 0);
      }
    });
    var html = '<table class="table table-bordered"><tr><th>类别</th><th>名称</th><th>中文名称</th><th>效果</th><th>代码</th><th>说明</th></tr>'+"\n";
    docs.forEach(function(doc){
      html += '<tr><td>'+doc.module+'</td><td>'+doc.name+'</td><td>'+doc.nameZH+'</td><td>'+doc.example+'</td><td>'+doc.code+'</td><td>'+doc.description+'</td></tr>'+"\n";
    });
    html += '</table>';
    return html;
  }

  function Doc(text){
    this.module = null;
    this.name = null;
    this.nameZH = null;
    this.example = null;
    this.code = null;
    this.description = null;
    this.text = text;
  }
  Doc.prototype = {
    parase: function(){
      var atName, atText, match;
      var self = this;
      var markedOptions = {};
      self.text.split(NEW_LINE).forEach(function(line){
        if ((match = line.match(/^\s*<!--@([\w\.]+)(\s+(.*))?-->([\s\S]*)?/))) {
          // we found @name ...
          // if we have existing name
          flush();
          atName = match[1];
          atText = [];
          if(match[3]) atText.push(match[3].trimRight());
          if(match[4]) atText.push(match[4].trimRight());
        } else {
          if (atName) {
            atText.push(line);
          }
        }
      });
      flush();
      this.description = marked(this.description, markedOptions);
      this.code = marked("```html\n"+this.example+"\n```", markedOptions);
      this.example = marked(this.example, markedOptions);
      return this;

      function flush(){
        if(!atName)return;
        var text = trim(atText.join('\n')), match;
        self[atName] = text;
      }
    }
  }

  function transformFunc(file, enc, cb) {
    if(!file.isStream()){
      if(file.contents)content += decoder.write(file.contents);
    }
    cb();
  };
  function flushFunc(cb) {
    cssStream.push(new File({
      base: CSSDEST,
      cwd: CSSDEST,
      path: path.join(CSSDEST, fileName),
      contents: new Buffer(template.replace('<!---CSSAMPLE-CONTENT--->', parseCssExample(content)) , 'utf8')
    }));
    cb();
  }
  var cssStream = through2.obj(transformFunc, flushFunc);
  return cssStream;
};
