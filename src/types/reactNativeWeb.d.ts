/**
 * `react-native-web` carries no types. react-native's types are used as they are.
 *
 * What a preview draws is react-native components, and react-native-web is that implementation
 * ported to the web, so the type surface is the same. Where they actually diverge shows up on
 * screen.
 */
declare module 'react-native-web' {
    export * from 'react-native';
}
