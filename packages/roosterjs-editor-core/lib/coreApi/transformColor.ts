import { arrayPush, getComputedStyles, safeInstanceOf, toArray } from 'roosterjs-editor-dom';
import {
    ColorTransformDirection,
    DarkModeDatasetNames,
    EditorCore,
    TransformColor,
} from 'roosterjs-editor-types';

const enum ColorAttributeEnum {
    CssColor = 0,
    HtmlColor = 1,
    CssDataSet = 2,
    HtmlDataSet = 3,
}

const ColorAttributeName: { [key in ColorAttributeEnum]: string }[] = [
    {
        [ColorAttributeEnum.CssColor]: 'color',
        [ColorAttributeEnum.HtmlColor]: 'color',
        [ColorAttributeEnum.CssDataSet]: DarkModeDatasetNames.OriginalStyleColor,
        [ColorAttributeEnum.HtmlDataSet]: DarkModeDatasetNames.OriginalAttributeColor,
    },
    {
        [ColorAttributeEnum.CssColor]: 'background-color',
        [ColorAttributeEnum.HtmlColor]: 'bgcolor',
        [ColorAttributeEnum.CssDataSet]: DarkModeDatasetNames.OriginalStyleBackgroundColor,
        [ColorAttributeEnum.HtmlDataSet]: DarkModeDatasetNames.OriginalAttributeBackgroundColor,
    },
];

/**
 * @internal
 * Edit and transform color of elements between light mode and dark mode
 * @param core The EditorCore object
 * @param rootNode The root HTML elements to transform
 * @param includeSelf True to transform the root node as well, otherwise false
 * @param callback The callback function to invoke before do color transformation
 * @param direction To specify the transform direction, light to dark, or dark to light
 */
export const transformColor: TransformColor = (
    core: EditorCore,
    rootNode: Node,
    includeSelf: boolean,
    callback: () => void,
    direction: ColorTransformDirection
) => {
    const elementsToTransform = core.lifecycle.isDarkMode ? getAll(rootNode, includeSelf) : [];
    const transformFunction =
        direction == ColorTransformDirection.DarkToLight
            ? transformToLightMode
            : core.lifecycle.onExternalContentTransform ||
              ((element: HTMLElement) => transformToDarkMode(element, core.lifecycle.getDarkColor));

    callback?.();

    elementsToTransform.forEach(
        element => element?.dataset && element.style && transformFunction(element)
    );
};

function transformToLightMode(element: HTMLElement) {
    const textColor = ColorAttributeName[0];
    const backgroundColor = ColorAttributeName[1];
    if (
        !element.dataset[textColor[ColorAttributeEnum.CssDataSet]] &&
        !element.dataset[textColor[ColorAttributeEnum.HtmlDataSet]]
    ) {
        transformToLightModeOperation(
            element,
            textColor[ColorAttributeEnum.CssColor],
            textColor[ColorAttributeEnum.CssDataSet],
            textColor[ColorAttributeEnum.HtmlColor],
            textColor[ColorAttributeEnum.HtmlDataSet]
        );
    }
    if (
        !element.dataset[backgroundColor[ColorAttributeEnum.CssDataSet]] &&
        !element.dataset[backgroundColor[ColorAttributeEnum.HtmlDataSet]]
    ) {
        transformToLightModeOperation(
            element,
            backgroundColor[ColorAttributeEnum.CssColor],
            backgroundColor[ColorAttributeEnum.CssDataSet],
            backgroundColor[ColorAttributeEnum.HtmlColor],
            backgroundColor[ColorAttributeEnum.HtmlDataSet]
        );
    }
}

function transformToDarkMode(element: HTMLElement, getDarkColor: (color: string) => string) {
    const textColor = ColorAttributeName[0];
    const backgroundColor = ColorAttributeName[1];
    if (
        !element.dataset[textColor[ColorAttributeEnum.CssDataSet]] &&
        !element.dataset[textColor[ColorAttributeEnum.HtmlDataSet]]
    ) {
        transformToLightDarkOperation(
            element,
            textColor[ColorAttributeEnum.CssColor],
            textColor[ColorAttributeEnum.CssDataSet],
            textColor[ColorAttributeEnum.HtmlColor],
            textColor[ColorAttributeEnum.HtmlDataSet],
            1,
            getDarkColor
        );
    }
    if (
        !element.dataset[backgroundColor[ColorAttributeEnum.CssDataSet]] &&
        !element.dataset[backgroundColor[ColorAttributeEnum.HtmlDataSet]]
    ) {
        transformToLightDarkOperation(
            element,
            backgroundColor[ColorAttributeEnum.CssColor],
            backgroundColor[ColorAttributeEnum.CssDataSet],
            backgroundColor[ColorAttributeEnum.HtmlColor],
            backgroundColor[ColorAttributeEnum.HtmlDataSet],
            0,
            getDarkColor
        );
    }
}

function getValueOrDefault(value: string, defaultValue: string | null) {
    return value && value != 'undefined' && value != 'null' ? value : defaultValue;
}

function getAll(rootNode: Node, includeSelf: boolean): HTMLElement[] {
    const result: HTMLElement[] = [];

    if (safeInstanceOf(rootNode, 'HTMLElement')) {
        if (includeSelf) {
            result.push(rootNode);
        }
        const allChildren = rootNode.getElementsByTagName('*');
        arrayPush(result, toArray(allChildren));
    } else if (safeInstanceOf(rootNode, 'DocumentFragment')) {
        const allChildren = rootNode.querySelectorAll('*');
        arrayPush(result, toArray(allChildren));
    }

    return result;
}

function transformToLightDarkOperation(
    element: HTMLElement,
    cssColor: string,
    cssDataSet: string,
    htmlColor: string,
    htmlDataSet: string,
    index: number,
    getDarkColor: (color: string) => string
) {
    const computedValues = getComputedStyles(element, ['color', 'background-color']);

    const styleColor = element.style.getPropertyValue(cssColor);
    const attrColor = element.getAttribute(htmlColor);

    if (
        !element.dataset[cssDataSet] &&
        !element.dataset[htmlDataSet] &&
        (styleColor || attrColor) &&
        styleColor != 'inherit' // For inherit style, no need to change it and let it keep inherit from parent element
    ) {
        const newColor = getDarkColor(computedValues[index] || styleColor || attrColor);
        element.style.setProperty(cssColor, newColor, 'important');
        element.dataset[cssDataSet] = styleColor || '';

        if (attrColor) {
            element.setAttribute(htmlColor, newColor);
            element.dataset[htmlDataSet] = attrColor;
        }
    }
}

function transformToLightModeOperation(
    element: HTMLElement,
    cssColor: string,
    cssDataSet: string,
    htmlColor: string,
    htmlDataSet: string
) {
    // Reset color styles based on the content of the ogsc/ogsb data element.
    // If those data properties are empty or do not exist, set them anyway to clear the content.
    element.style.setProperty(cssColor, getValueOrDefault(element.dataset[cssDataSet], ''));

    delete element.dataset[cssDataSet];

    // Some elements might have set attribute colors. We need to reset these as well.
    const value = element.dataset[htmlDataSet];

    if (getValueOrDefault(value, null)) {
        element.setAttribute(htmlColor, value);
    } else {
        element.removeAttribute(htmlColor);
    }

    delete element.dataset[htmlDataSet];
}
