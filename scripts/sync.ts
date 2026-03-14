import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, relative } from 'path';
import { execSync } from 'child_process';
import { zennMarkdownToQiitaMarkdown } from './lib';

const ARTICLES_DIR = join(process.cwd(), 'articles');
const QIITA_OUTPUT_DIR = join(process.cwd(), 'qiita', 'public');

function getLatestArticle(): string | null {
    try {
        const files = readdirSync(ARTICLES_DIR)
            .filter(f => f.endsWith('.md'))
            .map(f => {
                const path = join(ARTICLES_DIR, f);
                return { path, mtime: statSync(path).mtime };
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        return files.length > 0 ? files[0].path : null;
    } catch (e) {
        console.error(`Error reading articles directory: ${e}`);
        return null;
    }
}

function main() {
    try {
        // 1. Find latest article
        const latestArticle = getLatestArticle();
        if (!latestArticle) {
            console.error('No markdown articles found in articles directory.');
            process.exit(1);
        }
        const outputFilename = basename(latestArticle);
        console.log(`Syncing latest article: ${outputFilename}`);

        // 2. Convert
        const inputContent = readFileSync(latestArticle, 'utf8');
        const outputFilepath = join(QIITA_OUTPUT_DIR, outputFilename);
        const convertedContent = zennMarkdownToQiitaMarkdown(inputContent, outputFilepath);
        const latestArticleRelative = relative(process.cwd(), latestArticle);
        const outputRelative = relative(process.cwd(), outputFilepath);

        writeFileSync(outputFilepath, convertedContent, 'utf8');
        console.log(`Converted to: ${outputFilepath}`);

        // 3. Git commit and push
        console.log('Running git operations...');

        // Stage both the source article and the converted Qiita output.
        execSync(
            `git add -- ${JSON.stringify(latestArticleRelative)} ${JSON.stringify(outputRelative)}`,
            { stdio: 'inherit' }
        );

        // Only commit when there is something staged.
        const stagedStatus = execSync('git diff --cached --name-only').toString().trim();
        if (!stagedStatus) {
            console.log('No staged changes to commit.');
            return;
        }

        const commitMsg = `Update article (sync): ${outputFilename}`;
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

        console.log('Pushing to GitHub...');
        execSync('git push', { stdio: 'inherit' });

        console.log('Successfully synced to GitHub!');

    } catch (err) {
        console.error('Error during sync:', err);
        process.exit(1);
    }
}

main();
