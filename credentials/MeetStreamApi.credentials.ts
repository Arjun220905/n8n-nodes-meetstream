import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class MeetStreamApi implements ICredentialType {
	name = 'meetStreamApi';
	displayName = 'MeetStream API';
	icon: Icon = {
		light: 'file:../nodes/MeetStream/meetstream.svg',
		dark: 'file:../nodes/MeetStream/meetstream-dark.svg',
	};
	documentationUrl = 'https://docs.meetstream.ai';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Token {{$credentials.apiKey}}' } },
	};

	test: ICredentialTestRequest = {
		request: { baseURL: 'https://api.meetstream.ai/api/v1', url: '/bots', method: 'GET' },
	};
}
