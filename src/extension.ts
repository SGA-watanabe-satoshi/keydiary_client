// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { window, commands, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument, workspace } from 'vscode';
import crypto = require('crypto');
import * as httpClient from './http_client';
import * as model from './model';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.
    console.log('Congratulations, your extension "WordCount" is now active!');

    // create a new word counter
    let wordCounter = new WordCounter();
    let controller = new WordCounterController(wordCounter);

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(wordCounter);
    context.subscriptions.push(controller);
}

class WordCounter {

    private _statusBarItem: StatusBarItem;
    private _shasum = crypto.createHash('sha1');
    private _fileHash: string;
    private _events: model.DataModel[] = [];

    public updateWordCount() {

        // Create as needed
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        }

        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        let doc = editor.document;

        // Only update status if an Markdown file
        if (doc.languageId === "markdown") {
            let wordCount = this._getWordCount(doc);
            if (!this._fileHash) {
                this._shasum.update(doc.fileName);
                this._fileHash = this._shasum.digest('hex');
            }
            // Update the status bar
            this._statusBarItem.text =
                this.createDisplayText(wordCount, doc.languageId, doc.getText().length);
            console.log(this._statusBarItem.text);
            this._statusBarItem.show();
            this._addEvent(wordCount, doc.languageId, doc.getText().length);
        } else {
            this._statusBarItem.hide();
        }
    }

    private _addEvent(wordCount: number, languageId: string, charCount: number) {
        var m = new model.DataModel();
        m.WordCount = wordCount;
        m.LanguageID = languageId;
        m.CharCount = charCount;
        m.TimeStamp = new Date().toISOString();
        m.FilenameHash = this._fileHash;
        this._events.push(m);
    }

    private createDisplayText(wordCount: number, languageId: string, charCount: number): string {
        let languageText = `language: ${languageId}`;
        let wordCountText = wordCount !== 1 ? `${wordCount} Words` : '1 Word';
        let charCountText = `${charCount} Characters`;
        let timeStampText = `${new Date().toISOString()}`;
        let fileNameHashText = this._fileHash;
        return `${languageText} ${wordCountText} ${charCountText} ${timeStampText} ${fileNameHashText}`;
    }

    public _getWordCount(doc: TextDocument): number {

        let docContent = doc.getText();

        // Parse out unwanted whitespace so the split is accurate
        docContent = docContent.replace(/(< ([^>]+)<)/g, '').replace(/\s+/g, ' ');
        docContent = docContent.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
        let wordCount = 0;
        if (docContent != "") {
            wordCount = docContent.split(" ").length;
        }

        return wordCount;
    }

    public sendEvent(){
        new httpClient.HttpClinet().send(this._events);
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}

class WordCounterController {

    private _wordCounter: WordCounter;
    private _disposable: Disposable;

    constructor(wordCounter: WordCounter) {
        this._wordCounter = wordCounter;
        this._wordCounter.updateWordCount();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        workspace.onDidCloseTextDocument(this._onCloseEvent, this, subscriptions);
        
        // update the counter for the current file
        this._wordCounter.updateWordCount();

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEvent() {
        console.log("receive events");
        this._wordCounter.updateWordCount();
    }

    private _onCloseEvent() {
        console.log("close event");
        this._wordCounter.sendEvent();
    }
}