// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { window, commands, ExtensionContext } from 'vscode';
import fetch from 'node-fetch';
//npm install node-fetch --sae-dev
//mpm install @types/node-fetch 
//npm uninstall node-fetch
//npm install -s node-fetch@2

import { StatusBarAlignment, StatusBarItem, Selection, workspace, TextEditor, ProgressLocation } from 'vscode';
import { Memento } from "vscode";

const MAX_TEXT_LENGTH = 1500;
const projectNameFriendly = "AI Text Transformer";
const projectName = "aitexttransformer";

function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// /* See [here](https://www.chrishasz.com/blog/2020/07/28/vscode-how-to-use-local-storage-api/) to see how to store information across instances. */
// export class LocalStorageService {
    
//     constructor(private storage: Memento) { }   
    
//     public getValue<T>(key : string) : T{
//         return this.storage.get<T>(key, null);
//     }

//     public setValue<T>(key : string, value : T){
//         this.storage.update(key, value );
//     }
// }

async function callOpenAIMethod(prompt: string, apiKey: string) {


	
	const url = "https://api.openai.com/v1/chat/completions";

	const myData = {
		model: "gpt-3.5-turbo",
		messages: [
			{
				role: "user",
				content: prompt
			}
		]
	};

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Accept': 'application/json',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Content-Type': 'application/json',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify(myData),
	})
		;
	if (response.status === 200) {
		var json = await response.json();
		return json;
	}

	throw new Error(`Failed to speak to Open AI service. Response code ${response.status}`);

}

export async function callApiMethod(prompt: string, apiKey: string) {

	let retval = await window.withProgress({
		location: ProgressLocation.Notification,
		title: `${projectNameFriendly}\r\nCalling remote AI to improve selected text.\r\nPlease wait.`,
		cancellable: true
	}, async (progress, token) => {
		token.onCancellationRequested(() => {
			console.log("User canceled the operation");
		});
		//progress.report({ increment: 0 }); //Don't do this if it is indeterminate.
		const p = new Promise<{ success: Boolean, result: string, tokenCount: number }>(resolve => {
			callOpenAIMethod(prompt, apiKey).catch((reason) => {
				resolve({ success: false, result: "", tokenCount: 0 });
			}).then((val: any) => {
				const trimmedContent = val.choices[0].message.content.trim();
				resolve({ success: true, result: trimmedContent, tokenCount: val.usage.total_tokens });
			});
		});

		return p;
	});
	return retval;

}

async function showDialog(){
	//This is the only way to do a dialog,.
	await vscode.window
  .showInformationMessage("Do you want to do this?", "Yes", "No")
  .then(answer => {
    if (answer === "Yes") {
      // Run function
    }
  });
}

export function activate(context: vscode.ExtensionContext) {


	

	let disposable = vscode.commands.registerCommand(`${projectName}.transformSelectedText`, async () => {

		

		//Check the AI Service is supported. Otherwise, exit.
		const aiService = vscode.workspace.getConfiguration().get<string>(`${projectName}.aiService`);
		if (aiService !== "openAI") {
			vscode.window.showErrorMessage(`${projectNameFriendly}: AI Service \`${aiService}\` not supported. Try setting the \'${projectName}.aiService\` setting in the settings.json file.`);
			return;
		}

		if (!vscode.window.activeTextEditor) {
			vscode.window.showErrorMessage(`${projectNameFriendly}: Cannot run. There is no active document.`);
			return; // no editor
		}
		let editor = vscode.window.activeTextEditor;
		if (editor.selections.length > 1) {
			vscode.window.showErrorMessage(`${projectNameFriendly}: Cannot run. There are multiple selections.`);
			return;
		}
		if (editor.selections.length === 0) {
			vscode.window.showErrorMessage(`${projectNameFriendly}: Cannot run. Nothing is selected.`);
			return;
		}
		let selection = editor.selection;

		let { document } = editor;
		let selectedText = document.getText(selection);
		if (selectedText.length === 0) {
			vscode.window.showErrorMessage(`${projectNameFriendly}: Cannot run. Nothing is selected.`);
			return;
		}

		if (selectedText.length > MAX_TEXT_LENGTH) {
			vscode.window.showErrorMessage(`${projectNameFriendly}: Cannot run. The selected text length exceeds the maximum text length of ${MAX_TEXT_LENGTH} characters.`);
			return;
		}

		

		const defaultTransform = vscode.workspace.getConfiguration().get<string>(`${projectName}.defaultTransform`);

		const transformCommand = await window.showInputBox({
			prompt: "Describe how the selected text should be improved?\ne.g. more casual\r\n",
			value: defaultTransform,
			valueSelection: [0, defaultTransform?.length ?? 0],
			placeHolder: 'For example: more sarcastic OR funnier',
			validateInput: text => {
				//Check if the input is value.
				return null;
				// window.showInformationMessage(`Validating: ${text}`);
				// return text === '123' ? 'Not 123!' : null;
			}
		});
		if (!transformCommand) { return; }

		//Allow the capacity to skip confirmation. Don't expose this to the configuration system so that the way of discovering it is to read the code, thereby understanding the consequences of making the API calls.
		const secretSkipConfirmation = vscode.workspace.getConfiguration().get<boolean>(`${projectName}.skipConfirmation`);
		if (!secretSkipConfirmation) {
			const confirmationResult = await window.showQuickPick(['Yes', 'No'], {
				placeHolder: 'Are you sure? The AI service may charge you for this operation.',
				onDidSelectItem: item => { }
			});

			if (!confirmationResult || confirmationResult !== "Yes") {
				vscode.window.showInformationMessage(`${projectNameFriendly}: Execution cancelled.`);
				return;
			}
		}

		const defaultFullPrompt = vscode.workspace.getConfiguration().get<string>(`${projectName}.defaultFullPrompt`);
		let fullPrompt = <string>(defaultFullPrompt === null ? "" : defaultFullPrompt);
		fullPrompt = fullPrompt.replace("{0}", transformCommand);
		fullPrompt = fullPrompt.replace("{1}", selectedText);
		const apiKey = vscode.workspace.getConfiguration().get<string>(`${projectName}.apiKey`);

		if (!apiKey){
			vscode.window.showErrorMessage(`${projectNameFriendly}: No API key found in setting \`${projectName}.apiKey.\`. `);
			return;
		}

		const apiResult = await callApiMethod(fullPrompt, apiKey ?? "");
		if (!apiResult.success) {
			vscode.window.showErrorMessage(`${projectName}: Call to AI service failed.`);
			return;
		}

		window.showInformationMessage(`${projectNameFriendly}: A total of ${apiResult.tokenCount} tokens were used for this request.`);

		editor.edit(builder => {
			builder.replace(selection, apiResult.result);
		});

		//See [here](https://platform.openai.com/account/usage) for usage.
		//See [here](https://openai.com/pricing#image-models) for pricing. 
		//Currently: 	gpt-3.5-turbo	$0.002 / 1K tokens

	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
