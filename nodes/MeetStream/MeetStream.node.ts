import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const baseUrl = 'https://api.meetstream.ai/api/v1';

function isHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

export class MeetStream implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MeetStream',
		name: 'meetStream',
		icon: { light: 'file:meetstream.svg', dark: 'file:meetstream-dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Create and retrieve MeetStream meeting-bot artifacts',
		subtitle: '={{$parameter["resource"]}}: {{$parameter["operation"]}}',
		defaults: { name: 'MeetStream' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'meetStreamApi', required: true }],
		properties: [
			{
				displayName: 'Resource', name: 'resource', type: 'options', noDataExpression: true,
				options: [{ name: 'Bot', value: 'bot' }, { name: 'Transcript', value: 'transcript' }], default: 'bot',
			},
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['bot'] } },
				options: [
					{ name: 'Create Bot', value: 'createBot', action: 'Send a bot to a meeting' },
					{ name: 'Get Bot', value: 'getBot', action: 'Get the full bot record' },
					{ name: 'Get Recording', value: 'getRecording', action: 'Get the processed video recording' },
					{
						name: 'Get Summary', value: 'getSummary', action: 'Get the ai generated meeting summary',
						description: 'Returns a summary only after MeetStream has generated one. A 404 means no summary is available for this bot.',
					},
					{ name: 'Get Transcriptions', value: 'getTranscriptions', action: 'Get post call transcription runs' },
					{ name: 'Leave Meeting', value: 'removeBot', action: 'Make a bot leave while keeping its data' },
				], default: 'createBot',
			},
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['transcript'] } },
				options: [{
					name: 'Get Transcript', value: 'getTranscript', action: 'Get a transcript by transcript ID',
					description: 'Requires a post-call transcript ID. Bots using meeting_captions expose caption artifacts instead.',
				}], default: 'getTranscript',
			},
			{ displayName: 'Meeting Link', name: 'meetingLink', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } }, placeholder: 'https://meet.google.com/abc-defg-hij' },
			{ displayName: 'Bot Name', name: 'botName', type: 'string', default: 'MeetStream Notetaker', displayOptions: { show: { resource: ['bot'], operation: ['createBot'] } } },
			{ displayName: 'Bot ID', name: 'botId', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['bot'], operation: ['getBot', 'getTranscriptions', 'getRecording', 'getSummary', 'removeBot'] } } },
			{ displayName: 'Transcript ID', name: 'transcriptId', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['transcript'], operation: ['getTranscript'] } } },
			{
				displayName: 'Raw Response', name: 'raw', type: 'boolean', default: false,
				description: 'Whether to return the transcription provider response without MeetStream formatting',
				displayOptions: { show: { resource: ['transcript'], operation: ['getTranscript'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let method = 'GET';
				let url = '';
				let body: Record<string, unknown> | undefined;
				let qs: Record<string, boolean> | undefined;
				if (operation === 'createBot') {
					method = 'POST';
					url = '/bots/create_bot';
					const meetingLink = this.getNodeParameter('meetingLink', itemIndex) as string;
					if (meetingLink.trim() === '') throw new NodeOperationError(this.getNode(), 'Meeting Link is required', { itemIndex });
					if (!isHttpsUrl(meetingLink)) throw new NodeOperationError(this.getNode(), 'Meeting Link must be a valid HTTPS URL', { itemIndex });
					body = { meeting_link: meetingLink, bot_name: this.getNodeParameter('botName', itemIndex) };
				} else if (operation === 'getTranscript') {
					const transcriptId = this.getNodeParameter('transcriptId', itemIndex) as string;
					if (transcriptId.trim() === '') throw new NodeOperationError(this.getNode(), 'Transcript ID is required', { itemIndex });
					url = `/transcript/${encodeURIComponent(transcriptId)}/get_transcript`;
					if (this.getNodeParameter('raw', itemIndex) as boolean) qs = { raw: true };
				} else {
					const botIdValue = this.getNodeParameter('botId', itemIndex) as string;
					if (botIdValue.trim() === '') throw new NodeOperationError(this.getNode(), 'Bot ID is required', { itemIndex });
					const botId = encodeURIComponent(botIdValue);
					const endpoints: Record<string, string> = { getBot: 'detail', getTranscriptions: 'transcriptions', getRecording: 'get_video', getSummary: 'summary', removeBot: 'remove_bot' };
					if (!endpoints[operation]) throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
					url = `/bots/${botId}/${endpoints[operation]}`;
				}
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'meetStreamApi', {
					method, baseURL: baseUrl, url, body, qs, json: true, timeout: 60_000, allowedDomains: 'api.meetstream.ai',
				} as IHttpRequestOptions);
				returnData.push({ json: response as IDataObject, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
				else throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}
		return [returnData];
	}
}
