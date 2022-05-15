import tw, { css, styled } from "twin.macro";

export const transBg = css` background: linear-gradient(180deg, #5BCEFA 20%, #F5A9B8 20%, 40%, #FFFFFF 40%, 60%, #F5A9B8 60%, 80%, #5BCEFA 80%); `;

export const Root = tw.div`h-screen w-screen flex justify-center items-center dark:bg-gray-900`;
export const Container = tw.div`container flex flex-col`;

export const SummaryContainer = tw.div`flex mx-auto p-6 justify-center`;
export const SummaryContent = tw.div`ml-6 flex flex-col justify-center`;
export const SummaryTitleWrapper = tw.div`flex items-baseline`;
export const SummaryTitle = tw.div`text-lg md:text-xl text-gray-900 dark:text-gray-100 leading-tight pb-1`;
export const SummaryTitleAp = tw.div`text-xs md:text-sm text-gray-500 ml-1 md:ml-2 whitespace-nowrap`;
export const SummarySubtitleWrapper = tw.div`flex flex-col md:flex-row`;
export const SummarySubtitle = tw.div`text-sm md:text-base text-gray-600 dark:text-gray-400 leading-tight md:leading-normal`;
export const SummarySubtitleAp = tw(SummarySubtitle)`md:ml-1`;
export const AvatarWrapper = tw.div`flex-shrink-0 relative`;
export const Avatar = tw.img`h-16 w-16 rounded-full shadow`;
export const AvatarFlag = styled.div([tw`absolute bottom-0 right-0 h-4 w-6 rounded z-20 border-2 border-white shadow`, transBg]);

export const ParagraphWrapper = tw.div`px-6 pb-6 mx-auto pt-2 md:pt-4 max-w-lg md:max-w-xl`;
export const Paragraph = styled.div(({ alternative }) => [
  tw`mx-auto px-2 pb-4 leading-relaxed`,
  !alternative ? tw`text-sm md:text-base text-gray-700 dark:text-gray-200` : tw`text-xs md:text-sm text-gray-600 dark:text-gray-300 pt-2`
]);
export const A = styled.a(({ alternative }) => [
  tw`hover:underline`,
  !alternative ? tw`text-blue-600 dark:text-blue-300` : tw`text-blue-500 dark:text-blue-400`
]);
// export const Pre = tw.pre`text-gray-600 inline`