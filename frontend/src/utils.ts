export const getUserId = () => {
    let id = localStorage.getItem('poker_user_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('poker_user_id', id);
    }
    return id;
};
