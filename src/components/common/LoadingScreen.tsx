// src/components/common/LoadingScreen.tsx
import Image from 'next/image';

interface Props {
	message?: string;
}

export default function LoadingScreen({ message = '載入中...' }: Props) {
	return (
		<div style={{
			height: '100vh',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			background: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)',
		}}>
			<div style={{
				marginBottom: '2rem',
				position: 'relative',
				width: '350px',
				height: '350px',
			}}>
				<Image
					src="/K-dogmatic.png"
					alt="Loading"
					fill
					style={{ objectFit: 'contain' }}
					priority
					unoptimized
				/>
			</div>
			<div style={{
				color: '#e8e9ed',
				textAlign: 'center',
				fontSize: '1.5rem',
				fontWeight: 'bold',
			}}>
				{message}
			</div>
		</div>
	);
}