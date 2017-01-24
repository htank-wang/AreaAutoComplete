//获取光标相对页面的坐标点
;
(function () {
    var properties = [
        'direction',  // RTL support
        'boxSizing',
        'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
        'height',
        'overflowX',
        'overflowY',  // copy the scrollbar for IE

        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderStyle',

        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',

        // https://developer.mozilla.org/en-US/docs/Web/CSS/font
        'fontStyle',
        'fontVariant',
        'fontWeight',
        'fontStretch',
        'fontSize',
        'fontSizeAdjust',
        'lineHeight',
        'fontFamily',

        'textAlign',
        'textTransform',
        'textIndent',
        'textDecoration',  // might not make a difference, but better be safe

        'letterSpacing',
        'wordSpacing',

        'tabSize',
        'MozTabSize'

    ];

    var isBrowser = (typeof window !== 'undefined');
    var isFirefox = (isBrowser && window.mozInnerScreenX != null);

    function getCaretCoordinates(element, position, options) {
        if (!isBrowser) {
            throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
        }

        var debug = options && options.debug || false;
        if (debug) {
            var el = document.querySelector('#input-textarea-caret-position-mirror-div');
            if (el) {
                el.parentNode.removeChild(el);
            }
        }

        // mirrored div
        var div = document.createElement('div');
        div.id = 'input-textarea-caret-position-mirror-div';
        document.body.appendChild(div);

        var style = div.style;
        var computed = window.getComputedStyle ? getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9

        // default textarea styles
        style.whiteSpace = 'pre-wrap';
        if (element.nodeName !== 'INPUT')
            style.wordWrap = 'break-word';  // only for textarea-s

        // position off-screen
        style.position = 'absolute';  // required to return coordinates properly
        if (!debug)
            style.visibility = 'hidden';  // not 'display: none' because we want rendering

        // transfer the element's properties to the div
        properties.forEach(function (prop) {
            style[prop] = computed[prop];
        });

        if (isFirefox) {
            // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
            if (element.scrollHeight > parseInt(computed.height))
                style.overflowY = 'scroll';
        } else {
            style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
        }

        div.textContent = element.value.substring(0, position);
        // the second special handling for input type="text" vs textarea: spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
        if (element.nodeName === 'INPUT')
            div.textContent = div.textContent.replace(/\s/g, '\u00a0');

        var span = document.createElement('span');
        // Wrapping must be replicated *exactly*, including when a long word gets
        // onto the next line, with whitespace at the end of the line before (#7).
        // The  *only* reliable way to do that is to copy the *entire* rest of the
        // textarea's content into the <span> created at the caret position.
        // for inputs, just '.' would be enough, but why bother?
        span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
        div.appendChild(span);

        var coordinates = {
            top: span.offsetTop + parseInt(computed['borderTopWidth']),
            left: span.offsetLeft + parseInt(computed['borderLeftWidth'])
        };

        if (debug) {
            span.style.backgroundColor = '#aaa';
        } else {
            document.body.removeChild(div);
        }

        return coordinates;
    }

    if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
        module.exports = getCaretCoordinates;
    } else if (isBrowser) {
        window.getCaretCoordinates = getCaretCoordinates;
    }

}());
//获取光标文本位置
$.fn.getCursorPosition = function () {
    var input = this.get(0);
    if (!input) return; // No (input) element found
    if ('selectionStart' in input) {
        // Standard-compliant browsers
        return input.selectionStart;
    } else if (document.selection) {
        // IE
        input.focus();
        var sel = document.selection.createRange();
        var selLen = document.selection.createRange().text.length;
        sel.moveStart('character', -input.value.length);
        return sel.text.length - selLen;
    }
}
var AreaAutoComplete = function ($area, options) {
    var defaultSettings = {
        placeText: "选择关键字或轻敲空格完成输入",
        sources: []
    };

    this.options = $.extend(true, defaultSettings, options);
    this.$area = $area;
    this.init();
}

AreaAutoComplete.prototype = {
    vals: "",
    init: function () {
        this.$doc = $(document.body);
        this.sources = this.options.sources;
        this.initHitDom();
        this.bindEvent();
    },
    initHitDom: function () {
        var me = this;
        var id = "ui-layer-" + new Date().getTime();
        this.$doc.append('<div class="ui-layer-list " id="' + id + '" style="display: none"><div class="tt">' + this.options.placeText + '</div><ul></ul></div>');
        this.$hitDom = $("#" + id);
        var arr = [];
        for (var i = 0; i < this.sources.length; i++) {
            arr.push("<li data-id='" + this.sources[i].id + "'>" + this.sources[i].text + "</li>");
        }
        this.$hitDom.find("ul").html(arr.join(""));
        this.$hitDom.find("ul li").eq(0).addClass("cur");

        this.$hitDom.find("ul li").unbind("mouseover").bind("mouseover", function (e) {
            var $li = $(e.target).closest("li");
            if ($li.length) {
                me.$hitDom.find("ul li").removeClass("cur");
                $li.addClass("cur");
            }
        });
    },
    bindEvent: function () {
        var me = this;
        me.$area.bind("keydown", function (e) {
            var code = e.keyCode;
            if (me.$hitDom.is(":visible") && (code == "13" || code == "38" || code == "40")) {
                e.preventDefault();
                return false;
            }
        })

        me.$area.bind("keyup", function (e) {
            var code = e.keyCode;
            if (code == "13" || code == "38" || code == "40") {
            } else {
                me.showHit(me.$area.getCursorPosition());
            }
        })

        me.$hitDom.find("ul").unbind("click").bind("click", function (e) {
            var $tag = $(e.target);
            if (e.target.tagName == "LI") {
                me.updateVals();
            }
        })

        me.$doc.bind("click.uilayer", function () {
            me.$hitDom.hide();
        })

        me.$doc.bind("keyup.uilayer", function (e) {
            var code = e.keyCode;
            switch (code) {
                case 13://回车
                    me.updateVals();
                    break;
                case 38://上
                    me.selectLi(-1);
                    break;
                case 40://下
                    me.selectLi(1);
                    break;
            }
        })
    },
    selectLi: function (num) {
        var me = this;
        var $curLi = me.$hitDom.find(".cur");
        if ($curLi.length) {
            var index = $curLi.index() + num;
            var len = me.$hitDom.find("li").length;
            if (len != 1) {
                me.$hitDom.find("li").removeClass("cur");
                if (index + 1 > len) {
                    index = 0;
                } else if (index < 0) {
                    index = len - 1;
                }
                me.$hitDom.find("li").eq(index).addClass("cur")
            }
        }

    },
    updateVals: function () {
        if (!this.$hitDom.is(":visible")) return;
        var text = this.$hitDom.find("ul .cur").text();
        var index = this.$area.getCursorPosition();
        var html = this.$area.val();
        var str = html.substring(0, index);
        var lastStr = html.substring(index, html.length);
        var key = str.substring(str.lastIndexOf("@"), str.length);

        if (text) {
            this.$area.val(html.substring(0, str.lastIndexOf("@") + 1) + text + " " + lastStr);
            var len = (html.substring(0, str.lastIndexOf("@") + 1) + text + " ").length;
            this.$area[0].selectionStart = this.$area[0].selectionEnd = len;
        }

        this.$hitDom.hide();
    },
    showHit: function (selectionStart) {
        var me = this;
        var html = me.$area.val();
        var str = html.substring(0, selectionStart);
        var key = str.substring(str.lastIndexOf("@"), str.length);
        var word = key.replace("@", "");
        if (str.indexOf("@") == -1 || word.indexOf(" ") != -1 || word.split("\n").length > 1) {
            me.$hitDom.hide();
        } else {
            me.filterSources(word);
            me.setPosition();
            me.$hitDom.show();
        }
    },
    setSources: function (sources) {
        this.sources = sources || [];
    },
    filterSources: function (word) {
        var me = this;
        var arr = [];
        for (var i = 0, len = me.sources.length; i < len; i++) {
            if (me.sources[i].text.indexOf(word) != -1 && me.sources[i].noShow != "1") {
                arr.push("<li data-id='" + me.sources[i].id + "'>" + me.sources[i].text + "</li>");
            }
        }
        me.$hitDom.find("ul").html(arr.join(""));
        this.$hitDom.find("ul li").eq(0).addClass("cur");
        this.$hitDom.find("ul li").unbind("mouseover").bind("mouseover", function (e) {
            var $li = $(e.target).closest("li");
            if ($li.length) {
                me.$hitDom.find("ul li").removeClass("cur");
                $li.addClass("cur");
            }
        });
    }
    ,
    setPosition: function () {
        var el = this.$area[0];
        var cols = el.cols;
        var width = el.clientWidth;
        var height = this.$area.css('line-height');
        var pos = this.$area.offset();
        var selection;

        if (el.selectionStart) {
            selection = el.selectionStart;
        } else if (document.selection) {
            el.focus();
            var r = document.selection.createRange();
            if (r == null) {
                selection = 0;
            }
            var re = el.createTextRange(),
                rc = re.duplicate();
            re.moveToBookmark(r.getBookmark());
            rc.setEndPoint('EndToStart', re);
            selection = rc.text.length;
        } else {
            selection = 0
        }
        var str = this.$area.val().substring(0, selection);
        var index = str.lastIndexOf("@");
        var curpos = getCaretCoordinates(this.$area[0], index);
        var row = Math.floor((selection - 1) / cols);
        var col = ((selection - 1) - (row * cols));
        var x = Math.floor((col * (width / cols)));
        var y = (parseInt(height) * row) + parseInt(height);
        var left = pos.left + curpos.left;
        if (left > ($(window).width() - this.$hitDom.width() - 20)) {
            left = $(window).width() - this.$hitDom.width() - 20;
        }
        this.$hitDom.css({
            "top": (pos.top + curpos.top + 15 - this.$area.scrollTop()) + "px",
            "left": left + "px"
        })
    }
}