import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '../../app-ui/dist');
const targetDir = path.resolve(__dirname, '../public');

async function deployUI() {
  try {
    await fs.remove(targetDir);
    console.log('✓ 기존 public 폴더 삭제');

    await fs.copy(sourceDir, targetDir);
    console.log('✓ UI 빌드 결과물 복사 완료');

    console.log(`\n배포 완료: ${targetDir}`);
    
  } catch (error) {
    console.error('배포 실패:', error);
    process.exit(1);
  }
}

deployUI();